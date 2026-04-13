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

// === 스케줄 ===

export async function saveSchedule(schedule, yearMonth) {
  // 항상 localStorage에 백업
  localStorage.setItem(`${STORAGE_KEY}-${yearMonth}`, JSON.stringify(schedule));
  // Supabase에 저장 시도
  if (isSupabaseConfigured()) {
    await saveScheduleToDB(schedule, yearMonth);
  }
}

export async function loadSchedule(yearMonth) {
  // Supabase 우선
  if (isSupabaseConfigured()) {
    const data = await loadScheduleFromDB(yearMonth);
    if (data) return data;
  }
  // fallback: localStorage
  const local = localStorage.getItem(`${STORAGE_KEY}-${yearMonth}`);
  return local ? JSON.parse(local) : {};
}

// === 직원 ===

export async function saveEmployees(employees) {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  if (isSupabaseConfigured()) {
    await saveEmployeesToDB(employees);
  }
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

export async function saveShiftTypes(shiftTypes) {
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shiftTypes));
  if (isSupabaseConfigured()) {
    await saveShiftTypesToDB(shiftTypes);
  }
}

export async function loadShiftTypes() {
  if (isSupabaseConfigured()) {
    const data = await loadShiftTypesFromDB();
    if (data) return data;
  }
  const local = localStorage.getItem(SHIFTS_KEY);
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
