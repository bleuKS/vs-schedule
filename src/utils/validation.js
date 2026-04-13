import { EMPLOYMENT_TYPES } from '../data/employees';
import { isHoliday, isSunday } from '../data/holidays';
import { calculateBreakMinutes } from '../data/shiftTypes';

// 경고 수준
export const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
};

// 직원의 하루 근무시간 계산
export function getDailyHours(schedule, employeeId, dateStr) {
  const daySchedule = schedule[dateStr];
  if (!daySchedule) return 0;

  let hours = 0;
  for (let h = 8; h < 20; h++) {
    const key = `${h}`;
    if (daySchedule[key] && daySchedule[key].includes(employeeId)) {
      hours += 1;
    }
  }
  return hours;
}

// 직원의 주간 근무시간 계산
export function getWeeklyHours(schedule, employeeId, dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));

  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    total += getDailyHours(schedule, employeeId, ds);
  }
  return total;
}

// 직원의 월간 근무시간 계산
export function getMonthlyHours(schedule, employeeId, year, month) {
  let total = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    total += getDailyHours(schedule, employeeId, ds);
  }
  return total;
}

// 연속 근무일수 계산
export function getConsecutiveDays(schedule, employeeId, dateStr) {
  let count = 0;
  const date = new Date(dateStr);

  // 이전 방향으로 계산
  for (let i = 0; i <= 13; i++) {
    const d = new Date(date);
    d.setDate(date.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (getDailyHours(schedule, employeeId, ds) > 0) {
      count++;
    } else {
      break;
    }
  }
  // 다음 방향으로 계산 (당일 제외)
  for (let i = 1; i <= 13; i++) {
    const d = new Date(date);
    d.setDate(date.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (getDailyHours(schedule, employeeId, ds) > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// 전체 검증 실행
export function validateSchedule(schedule, employees, year, month) {
  const warnings = [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const emp of employees) {
    const empType = Object.values(EMPLOYMENT_TYPES).find(t => t.id === emp.type);
    if (!empType) continue;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dailyHours = getDailyHours(schedule, emp.id, dateStr);

      if (dailyHours === 0) continue;

      // 일요일 근무
      if (isSunday(dateStr)) {
        warnings.push({
          severity: SEVERITY.ERROR,
          employee: emp.name,
          date: dateStr,
          rule: '일요일 근무',
          message: `${emp.name}: 일요일 근무 배정 (독일법 영업 금지)`,
        });
      }

      // 공휴일 근무
      const holiday = isHoliday(dateStr);
      if (holiday) {
        warnings.push({
          severity: SEVERITY.WARNING,
          employee: emp.name,
          date: dateStr,
          rule: '공휴일 근무',
          message: `${emp.name}: ${holiday.nameKo}(${holiday.name}) 근무 배정`,
        });
      }

      // 정기 휴무일 위반
      const dayOfWeek = new Date(dateStr).getDay();
      if (emp.dayOff !== null && dayOfWeek === emp.dayOff) {
        warnings.push({
          severity: SEVERITY.WARNING,
          employee: emp.name,
          date: dateStr,
          rule: '정기 휴무일 위반',
          message: `${emp.name}: 정기 휴무일에 근무 배정`,
        });
      }

      // 일일 최대 근무시간
      if (dailyHours > empType.maxDailyHours) {
        warnings.push({
          severity: SEVERITY.ERROR,
          employee: emp.name,
          date: dateStr,
          rule: '일일 최대 초과',
          message: `${emp.name}: ${dailyHours}h 근무 (최대 ${empType.maxDailyHours}h)`,
        });
      } else if (empType.recommendedDailyHours && dailyHours > empType.recommendedDailyHours && emp.type !== 'minderjaehrig') {
        warnings.push({
          severity: SEVERITY.WARNING,
          employee: emp.name,
          date: dateStr,
          rule: '일일 권장 초과',
          message: `${emp.name}: ${dailyHours}h 근무 (권장 ${empType.recommendedDailyHours}h)`,
        });
      }

      // 휴게시간 체크
      const requiredBreak = calculateBreakMinutes(dailyHours);
      if (requiredBreak > 0) {
        // 그리드 기반에서는 휴게시간을 직접 추적하기 어려움 → 경고만 표시
        warnings.push({
          severity: SEVERITY.WARNING,
          employee: emp.name,
          date: dateStr,
          rule: '휴게시간 확인',
          message: `${emp.name}: ${dailyHours}h 근무 — 최소 ${requiredBreak}분 휴게 필요`,
        });
      }

      // 연속 근무일
      const consecutive = getConsecutiveDays(schedule, emp.id, dateStr);
      if (consecutive > 6 && d === new Date(dateStr).getDate()) {
        // 중복 방지: 해당 날에만 경고
        const alreadyWarned = warnings.find(
          w => w.employee === emp.name && w.rule === '연속 근무 초과' && w.date === dateStr
        );
        if (!alreadyWarned) {
          warnings.push({
            severity: SEVERITY.ERROR,
            employee: emp.name,
            date: dateStr,
            rule: '연속 근무 초과',
            message: `${emp.name}: ${consecutive}일 연속 근무 (최대 6일)`,
          });
        }
      }
    }

    // 주간 체크 (월별 각 주 시작일 기준)
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    // 해당 월의 첫 번째 월요일 찾기
    let mondayOffset = (8 - startDow) % 7;
    if (mondayOffset === 0 && startDow !== 1) mondayOffset = 7;
    if (startDow === 1) mondayOffset = 0;

    for (let weekStart = 1 - ((startDow + 6) % 7); weekStart <= daysInMonth; weekStart += 7) {
      const mondayDate = new Date(year, month, weekStart);
      const mondayStr = mondayDate.toISOString().split('T')[0];
      const weeklyHours = getWeeklyHours(schedule, emp.id, mondayStr);

      if (empType.maxWeeklyHours && weeklyHours > empType.maxWeeklyHours) {
        warnings.push({
          severity: SEVERITY.ERROR,
          employee: emp.name,
          date: mondayStr,
          rule: emp.type === 'werkstudent' ? '학생 주당 초과' : '주당 최대 초과',
          message: `${emp.name}: 주 ${weeklyHours}h (최대 ${empType.maxWeeklyHours}h)`,
        });
      } else if (empType.recommendedWeeklyHours && weeklyHours > empType.recommendedWeeklyHours) {
        warnings.push({
          severity: SEVERITY.WARNING,
          employee: emp.name,
          date: mondayStr,
          rule: '주당 권장 초과',
          message: `${emp.name}: 주 ${weeklyHours}h (권장 ${empType.recommendedWeeklyHours}h)`,
        });
      }
    }

    // 미니잡 월간 체크
    if (empType.maxMonthlyHours) {
      const monthlyHours = getMonthlyHours(schedule, emp.id, year, month);
      if (monthlyHours > empType.maxMonthlyHours) {
        warnings.push({
          severity: SEVERITY.ERROR,
          employee: emp.name,
          date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          rule: '미니잡 월 한도 초과',
          message: `${emp.name}: 월 ${monthlyHours}h (한도 ${empType.maxMonthlyHours}h)`,
        });
      }
    }
  }

  return warnings;
}
