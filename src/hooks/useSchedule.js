import { useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_EMPLOYEES } from '../data/employees';
import { DEFAULT_STORE_SHIFT_TYPES, DEFAULT_CAFE_SHIFT_TYPES, getShiftSlots } from '../data/shiftTypes';
import {
  saveSchedule,
  loadSchedule,
  saveEmployees,
  loadEmployees,
  saveShiftTypes,
  loadShiftTypes,
} from '../utils/storage';

const MAX_UNDO = 50;
const SAVE_DEBOUNCE = 600;
const RETRY_DELAYS = [1500, 4000];

const DEFAULT_SHIFTS_BY_SCOPE = {
  store: DEFAULT_STORE_SHIFT_TYPES,
  cafe: DEFAULT_CAFE_SHIFT_TYPES,
};

export function useSchedule(options = {}) {
  const {
    scope = 'store',
    externalYear,
    externalMonth,
    onYearMonthChange,
    manageEmployees = true, // false면 직원 로드/저장 건너뜀 (외부에서 공유)
  } = options;

  const [schedule, setSchedule] = useState({});
  const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
  const [shiftTypes, setShiftTypes] = useState(DEFAULT_SHIFTS_BY_SCOPE[scope] || DEFAULT_STORE_SHIFT_TYPES);
  const [internalYear, setInternalYear] = useState(2026);
  const [internalMonth, setInternalMonth] = useState(3);
  const currentYear = externalYear ?? internalYear;
  const currentMonth = externalMonth ?? internalMonth;
  const setCurrentYear = onYearMonthChange
    ? (y) => onYearMonthChange(y, currentMonth)
    : setInternalYear;
  const setCurrentMonth = onYearMonthChange
    ? (m) => onYearMonthChange(currentYear, m)
    : setInternalMonth;

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const saveTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const pendingRef = useRef(null); // { schedule, yearMonth }
  const flushVersionRef = useRef(0);
  const savedStatusTimerRef = useRef(null);

  const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const loaders = [loadSchedule(yearMonth, scope), loadShiftTypes(scope)];
      if (manageEmployees) loaders.push(loadEmployees());
      const results = await Promise.all(loaders);
      if (cancelled) return;
      const sched = results[0];
      const shifts = results[1];
      const emps = manageEmployees ? results[2] : null;
      setSchedule(sched || {});
      if (shifts) setShiftTypes(shifts);
      if (manageEmployees && emps) setEmployees(emps);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [yearMonth, scope, manageEmployees]);

  const performSave = useCallback(async (targetSchedule, targetYearMonth) => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    flushVersionRef.current += 1;
    const myVersion = flushVersionRef.current;
    setSaveStatus('saving');
    setSaveError(null);

    let attempt = 0;
    const maxAttempts = RETRY_DELAYS.length + 1;
    while (attempt < maxAttempts) {
      const result = await saveSchedule(targetSchedule, targetYearMonth, scope);
      if (myVersion !== flushVersionRef.current) return; // 최신 flush에 의해 무효화됨
      if (result.ok) {
        pendingRef.current = null;
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
        savedStatusTimerRef.current = setTimeout(() => {
          setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev));
        }, 2500);
        return;
      }
      attempt++;
      if (attempt >= maxAttempts) {
        setSaveStatus('error');
        setSaveError(result.error || '알 수 없는 오류');
        return;
      }
      await new Promise(r => { retryTimerRef.current = setTimeout(r, RETRY_DELAYS[attempt - 1]); });
      if (myVersion !== flushVersionRef.current) return;
    }
  }, [scope]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const p = pendingRef.current;
    if (!p) return;
    await performSave(p.schedule, p.yearMonth);
  }, [performSave]);

  const scheduleSave = useCallback((newSchedule, targetYearMonth) => {
    pendingRef.current = { schedule: newSchedule, yearMonth: targetYearMonth };
    setSaveStatus(prev => (prev === 'error' ? prev : 'saving'));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      if (p) performSave(p.schedule, p.yearMonth);
    }, SAVE_DEBOUNCE);
  }, [performSave]);

  // schedule 변경 시 debounce 저장
  const firstScheduleSkipRef = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (firstScheduleSkipRef.current) {
      firstScheduleSkipRef.current = false;
      return;
    }
    scheduleSave(schedule, yearMonth);
  }, [schedule, loading, yearMonth, scheduleSave]);

  // 월 이동 시 첫 렌더 스킵 플래그 재설정 (이미 로드된 값은 저장 불필요)
  useEffect(() => {
    firstScheduleSkipRef.current = true;
  }, [yearMonth]);

  // 직원/시프트 변경 시 저장 (별도 저장 상태 표시 없음, 조용히 저장)
  const firstEmpSkipRef = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (firstEmpSkipRef.current) { firstEmpSkipRef.current = false; return; }
    if (manageEmployees) saveEmployees(employees);
  }, [employees, loading, manageEmployees]);

  const firstShiftSkipRef = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (firstShiftSkipRef.current) { firstShiftSkipRef.current = false; return; }
    saveShiftTypes(shiftTypes, scope);
  }, [shiftTypes, loading, scope]);

  // 페이지 이탈 시 pending save flush (동기 sendBeacon + sync 시도)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pendingRef.current) {
        // Supabase는 비동기라 beforeunload 내에서 완료 보장 불가
        // localStorage는 saveSchedule 내부에서 이미 동기 저장됨
        // 사용자에게 경고 프롬프트 표시
        e.preventDefault();
        e.returnValue = '저장 중입니다. 잠시만 기다려주세요.';
        flushPendingSave();
        return e.returnValue;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current) {
        flushPendingSave();
      }
    };
    const handlePageHide = () => {
      if (pendingRef.current) flushPendingSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushPendingSave]);

  // 언마운트 시 타이머 cleanup + 마지막 flush 시도
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        const p = pendingRef.current;
        saveSchedule(p.schedule, p.yearMonth, scope);
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
    };
  }, [scope]);

  const pushUndo = useCallback((prev) => {
    undoStack.current.push(JSON.stringify(prev));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const addEmployeeToSlot = useCallback((dateStr, slotKey, employeeId) => {
    const key = String(slotKey);
    setSchedule(prev => {
      pushUndo(prev);
      const day = prev[dateStr] || {};
      const slot = day[key] || [];
      if (slot.includes(employeeId)) return prev;
      return {
        ...prev,
        [dateStr]: { ...day, [key]: [...slot, employeeId] },
      };
    });
  }, [pushUndo]);

  const removeEmployeeFromSlot = useCallback((dateStr, slotKey, employeeId) => {
    const key = String(slotKey);
    setSchedule(prev => {
      pushUndo(prev);
      const day = prev[dateStr] || {};
      const slot = day[key] || [];
      return {
        ...prev,
        [dateStr]: { ...day, [key]: slot.filter(id => id !== employeeId) },
      };
    });
  }, [pushUndo]);

  const assignShift = useCallback((dateStr, employeeId, shiftType) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = { ...(prev[dateStr] || {}) };
      const slots = getShiftSlots(shiftType);
      for (const h of slots) {
        const existing = day[`${h}`] || [];
        if (!existing.includes(employeeId)) {
          day[`${h}`] = [...existing, employeeId];
        }
      }
      return { ...prev, [dateStr]: day };
    });
  }, [pushUndo]);

  const clearEmployeeDay = useCallback((dateStr, employeeId) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = { ...(prev[dateStr] || {}) };
      for (const key of Object.keys(day)) {
        const slot = day[key] || [];
        day[key] = slot.filter(id => id !== employeeId);
      }
      return { ...prev, [dateStr]: day };
    });
  }, [pushUndo]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(JSON.stringify(schedule));
    setSchedule(JSON.parse(prev));
  }, [schedule]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current.push(JSON.stringify(schedule));
    setSchedule(JSON.parse(next));
  }, [schedule]);

  const replaceSchedule = useCallback((newSchedule) => {
    pushUndo(schedule);
    setSchedule(newSchedule);
  }, [schedule, pushUndo]);

  return {
    schedule,
    employees,
    setEmployees,
    shiftTypes,
    setShiftTypes,
    currentYear,
    setCurrentYear,
    currentMonth,
    setCurrentMonth,
    addEmployeeToSlot,
    removeEmployeeFromSlot,
    assignShift,
    clearEmployeeDay,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    replaceSchedule,
    loading,
    saveStatus,
    lastSavedAt,
    saveError,
    flushPendingSave,
  };
}
