import {
  isSupabaseConfigured,
  saveScheduleToDB,
  loadScheduleFromDB,
  saveEmployeesToDB,
  loadEmployeesFromDB,
  saveShiftTypesToDB,
  loadShiftTypesFromDB,
} from './supabase';

const STORAGE_KEY = 'vibeseoul-schedule';
const EMPLOYEES_KEY = 'vibeseoul-employees';
const SHIFTS_KEY = 'vibeseoul-shifts';

// scope별 저장 키 생성 (store는 기존 호환 위해 접미사 없음)
function scopedKey(yearMonth, scope) {
  return scope && scope !== 'store' ? `${yearMonth}-${scope}` : yearMonth;
}

// === 스케줄 ===

// schedule 객체가 비어 있는지 판정 (키 자체가 없거나, 모든 날짜 슬롯이 비어 있음).
function isEmptySchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return true;
  const keys = Object.keys(schedule);
  if (keys.length === 0) return true;
  return keys.every((dateKey) => {
    const day = schedule[dateKey];
    if (!day || typeof day !== 'object') return true;
    return Object.values(day).every((slot) => !Array.isArray(slot) || slot.length === 0);
  });
}

export async function saveSchedule(schedule, yearMonth, scope = 'store') {
  const key = scopedKey(yearMonth, scope);

  // 방어층: 빈 스케줄로 기존 DB 데이터를 덮어쓰는 사고를 차단.
  // 기존 DB에 데이터가 있는데 빈 객체로 덮어쓰려는 경우 저장을 거절.
  if (isEmptySchedule(schedule)) {
    if (isSupabaseConfigured()) {
      try {
        const existing = await loadScheduleFromDB(key);
        if (existing && !isEmptySchedule(existing)) {
          return { ok: false, error: '빈 스케줄로 기존 데이터를 덮어쓰는 것을 방지했습니다.' };
        }
      } catch {
        // 로드 실패 시 저장도 보수적으로 스킵.
        return { ok: false, error: '기존 데이터 확인 실패 — 저장 보류.' };
      }
    } else {
      const existingLocal = localStorage.getItem(`${STORAGE_KEY}-${key}`);
      if (existingLocal) {
        try {
          const parsed = JSON.parse(existingLocal);
          if (!isEmptySchedule(parsed)) {
            return { ok: false, error: '빈 스케줄로 기존 데이터를 덮어쓰는 것을 방지했습니다.' };
          }
        } catch { /* 파싱 실패면 덮어써도 됨 */ }
      }
    }
  }

  try {
    localStorage.setItem(`${STORAGE_KEY}-${key}`, JSON.stringify(schedule));
  } catch (err) {
    return { ok: false, error: `로컬 저장 실패: ${err.message}` };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, local: true };
  }

  const result = await saveScheduleToDB(schedule, key);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

// 반환 형태: { ok: true, data: object }  성공 (빈 월이면 data = {})
//            { ok: false, error: string } 실제 로드 실패 — 호출자는 저장을 보류해야 함
export async function loadSchedule(yearMonth, scope = 'store') {
  const key = scopedKey(yearMonth, scope);
  if (isSupabaseConfigured()) {
    const res = await loadScheduleFromDB(key);
    if (!res.ok) {
      // 네트워크/권한 오류 — 로컬 캐시라도 있으면 읽어주되 loadFailed 플래그로 저장 차단.
      const local = localStorage.getItem(`${STORAGE_KEY}-${key}`);
      return {
        ok: false,
        error: res.error,
        data: local ? JSON.parse(local) : {},
      };
    }
    if (res.data) return { ok: true, data: res.data };
    // DB에 레코드 없음 → localStorage fallback
  }
  const local = localStorage.getItem(`${STORAGE_KEY}-${key}`);
  return { ok: true, data: local ? JSON.parse(local) : {} };
}

// === 직원 ===

export async function saveEmployees(employees) {
  try {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  } catch (err) {
    return { ok: false, error: err.message };
  }
  if (isSupabaseConfigured()) {
    const r = await saveEmployeesToDB(employees);
    if (!r.ok) return { ok: false, error: r.error };
  }
  return { ok: true };
}

export async function loadEmployees() {
  if (isSupabaseConfigured()) {
    const data = await loadEmployeesFromDB();
    if (data) return data;
  }
  const local = localStorage.getItem(EMPLOYEES_KEY);
  return local ? JSON.parse(local) : null;
}

// === 시프트 타입 ===

export async function saveShiftTypes(shiftTypes, scope = 'store') {
  const localKey = scope === 'store' ? SHIFTS_KEY : `${SHIFTS_KEY}-${scope}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(shiftTypes));
  } catch (err) {
    return { ok: false, error: err.message };
  }
  if (isSupabaseConfigured()) {
    const r = await saveShiftTypesToDB(shiftTypes, scope);
    if (!r.ok) return { ok: false, error: r.error };
  }
  return { ok: true };
}

export async function loadShiftTypes(scope = 'store') {
  if (isSupabaseConfigured()) {
    const data = await loadShiftTypesFromDB(scope);
    if (data) return data;
  }
  const localKey = scope === 'store' ? SHIFTS_KEY : `${SHIFTS_KEY}-${scope}`;
  const local = localStorage.getItem(localKey);
  return local ? JSON.parse(local) : null;
}

// === 내보내기/가져오기 (변경 없음) ===

export function exportToJSON(schedule, employees, shiftTypes) {
  const data = { schedule, employees, shiftTypes, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('잘못된 JSON 파일입니다.'));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
  });
}

export function exportToCSV(schedule, employees, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  let csv = '시간대';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) continue;
    csv += `,${d}일(${dayNames[date.getDay()]})`;
  }
  csv += '\n';

  for (let h = 8; h < 20; h++) {
    csv += `${h}:00~${h + 1}:00`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date.getDay() === 0) continue;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySchedule = schedule[dateStr];
      const names = daySchedule?.[`${h}`]
        ? daySchedule[`${h}`].map(id => {
            const emp = employees.find(e => e.id === id);
            return emp ? emp.name : id;
          }).join(' / ')
        : '';
      csv += `,"${names}"`;
    }
    csv += '\n';
  }

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-${year}-${String(month + 1).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
