import { useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_EMPLOYEES } from '../data/employees';
import { DEFAULT_SHIFT_TYPES } from '../data/shiftTypes';
import {
  saveSchedule,
  loadSchedule,
  saveEmployees,
  loadEmployees,
  saveShiftTypes,
  loadShiftTypes,
} from '../utils/storage';

const MAX_UNDO = 50;
const SAVE_DEBOUNCE = 800;

export function useSchedule() {
  const [schedule, setSchedule] = useState({});
  const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
  const [shiftTypes, setShiftTypes] = useState(DEFAULT_SHIFT_TYPES);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(3); // 0-indexed, 3 = April
  const [loading, setLoading] = useState(true);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const saveTimerRef = useRef(null);

  const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // 초기 로딩
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [sched, emps, shifts] = await Promise.all([
        loadSchedule(yearMonth),
        loadEmployees(),
        loadShiftTypes(),
      ]);
      if (cancelled) return;
      setSchedule(sched || {});
      if (emps) setEmployees(emps);
      if (shifts) setShiftTypes(shifts);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [yearMonth]);

  // 월 변경 시 스케줄 다시 로딩
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sched = await loadSchedule(yearMonth);
      if (!cancelled) setSchedule(sched || {});
    })();
    return () => { cancelled = true; };
  }, [yearMonth]);

  // debounce 저장
  const debouncedSaveSchedule = useCallback((newSchedule) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSchedule(newSchedule, yearMonth);
    }, SAVE_DEBOUNCE);
  }, [yearMonth]);

  // 스케줄 변경 시 자동 저장
  useEffect(() => {
    if (!loading) {
      debouncedSaveSchedule(schedule);
    }
  }, [schedule, loading, debouncedSaveSchedule]);

  // 직원/시프트 변경 시 저장
  useEffect(() => {
    if (!loading) saveEmployees(employees);
  }, [employees, loading]);

  useEffect(() => {
    if (!loading) saveShiftTypes(shiftTypes);
  }, [shiftTypes, loading]);

  const pushUndo = useCallback((prev) => {
    undoStack.current.push(JSON.stringify(prev));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const addEmployeeToSlot = useCallback((dateStr, hour, employeeId) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = prev[dateStr] || {};
      const slot = day[`${hour}`] || [];
      if (slot.includes(employeeId)) return prev;
      return {
        ...prev,
        [dateStr]: { ...day, [`${hour}`]: [...slot, employeeId] },
      };
    });
  }, [pushUndo]);

  const removeEmployeeFromSlot = useCallback((dateStr, hour, employeeId) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = prev[dateStr] || {};
      const slot = day[`${hour}`] || [];
      return {
        ...prev,
        [dateStr]: { ...day, [`${hour}`]: slot.filter(id => id !== employeeId) },
      };
    });
  }, [pushUndo]);

  const assignShift = useCallback((dateStr, employeeId, shiftType) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = { ...(prev[dateStr] || {}) };
      for (let h = shiftType.start; h < shiftType.end; h++) {
        const slot = day[`${h}`] || [];
        if (!slot.includes(employeeId)) {
          day[`${h}`] = [...slot, employeeId];
        }
      }
      return { ...prev, [dateStr]: day };
    });
  }, [pushUndo]);

  const clearEmployeeDay = useCallback((dateStr, employeeId) => {
    setSchedule(prev => {
      pushUndo(prev);
      const day = { ...(prev[dateStr] || {}) };
      for (let h = 8; h < 20; h++) {
        const slot = day[`${h}`] || [];
        day[`${h}`] = slot.filter(id => id !== employeeId);
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
  };
}
