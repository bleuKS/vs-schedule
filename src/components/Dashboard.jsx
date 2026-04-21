import { useMemo } from 'react';
import { EMPLOYMENT_TYPES } from '../data/employees';
import { getMonthlyHours, getDailyHours } from '../utils/validation';

export default function Dashboard({ schedule, employees, currentYear, currentMonth }) {
  const stats = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    return employees.map(emp => {
      const type = Object.values(EMPLOYMENT_TYPES).find(t => t.id === emp.type);
      const monthlyHours = getMonthlyHours(schedule, emp.id, currentYear, currentMonth);

      // 일별 근무시간
      const dailyHours = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(currentYear, currentMonth, d);
        if (date.getDay() === 0) continue;
        dailyHours.push({
          date: d,
          hours: getDailyHours(schedule, emp.id, dateStr),
        });
      }

      const workDays = dailyHours.filter(d => d.hours > 0).length;

      // 미니잡 한도 소진율
      let limitPercent = null;
      if (type?.maxMonthlyHours) {
        limitPercent = Math.round((monthlyHours / type.maxMonthlyHours) * 100);
      }

      return {
        ...emp,
        type,
        monthlyHours,
        workDays,
        limitPercent,
        dailyHours,
      };
    });
  }, [schedule, employees, currentYear, currentMonth]);

  // 일별 총 인원수
  const dailyStaffCount = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const counts = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(currentYear, currentMonth, d);
      if (date.getDay() === 0) continue;
      const empIds = new Set();
      const daySchedule = schedule[dateStr] || {};
      for (const key of Object.keys(daySchedule)) {
        const slot = daySchedule[key];
        if (Array.isArray(slot)) slot.forEach(id => empIds.add(id));
      }
      counts.push({ date: d, count: empIds.size, dayOfWeek: date.getDay() });
    }
    return counts;
  }, [schedule, currentYear, currentMonth]);

  return (
    <div className="dashboard">
      <h3>월간 요약</h3>

      <div className="daily-staff-chart">
        <h4>일별 투입 인원</h4>
        <div className="bar-chart">
          {dailyStaffCount.map(d => (
            <div key={d.date} className="bar-item">
              <div
                className="bar"
                style={{
                  height: `${Math.max(d.count * 12, 4)}px`,
                  backgroundColor: d.count < 3 ? '#f44336' : d.count < 5 ? '#ff9800' : '#4caf50',
                }}
                title={`${d.date}일: ${d.count}명`}
              />
              <span className="bar-label">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="employee-stats">
        <h4>직원별 근무 현황</h4>
        <table className="stats-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>유형</th>
              <th>근무일</th>
              <th>총 시간</th>
              <th>한도</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.id} className={s.limitPercent > 100 ? 'over-limit' : ''}>
                <td style={{ color: s.type?.color }}>{s.name}</td>
                <td>{s.type?.label}</td>
                <td>{s.workDays}일</td>
                <td>{s.monthlyHours}h</td>
                <td>
                  {s.limitPercent !== null ? (
                    <div className="limit-bar-wrapper">
                      <div
                        className="limit-bar"
                        style={{
                          width: `${Math.min(s.limitPercent, 100)}%`,
                          backgroundColor: s.limitPercent > 100 ? '#f44336' : s.limitPercent > 80 ? '#ff9800' : '#4caf50',
                        }}
                      />
                      <span>{s.limitPercent}%</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
