import { useState, useMemo } from 'react';
import { EMPLOYMENT_TYPES } from '../data/employees';
import { isHoliday, isSunday } from '../data/holidays';
import { slotLabel } from '../data/shiftTypes';

export default function ScheduleGrid({
  schedule,
  employees,
  shiftTypes,
  currentYear,
  currentMonth,
  onAddEmployee,
  onRemoveEmployee,
  onAssignShift,
  onClearDay,
  selectedEmployee,
  setSelectedEmployee,
  selectedShift,
  hourStart = 8,
  hourEnd = 20,
  slots: explicitSlots,
  timeLabel,
}) {
  // 슬롯 키 리스트 — explicit 우선, 없으면 hour 범위로 정수 슬롯 생성
  const SLOT_KEYS = useMemo(() => {
    if (Array.isArray(explicitSlots) && explicitSlots.length) {
      return explicitSlots.map(s => String(s));
    }
    return Array.from({ length: hourEnd - hourStart }, (_, i) => String(hourStart + i));
  }, [explicitSlots, hourStart, hourEnd]);

  const formatLabel = timeLabel || ((key) => slotLabel(key));
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [currentWeek, setCurrentWeek] = useState(0);

  const days = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(currentYear, currentMonth, d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) continue; // 일요일 제외
      result.push({ date: d, dateStr, dayOfWeek, holiday: isHoliday(dateStr) });
    }
    return result;
  }, [currentYear, currentMonth]);

  // 주간 뷰용 주 분리
  const weeks = useMemo(() => {
    const result = [];
    let currentWeekDays = [];
    let lastWeekNum = -1;

    for (const day of days) {
      const [yy, mm, dd] = day.dateStr.split('-').map(Number);
      const d = new Date(yy, mm - 1, dd);
      const weekNum = Math.floor((d.getDate() + new Date(currentYear, currentMonth, 1).getDay() - 1) / 7);
      if (weekNum !== lastWeekNum && currentWeekDays.length > 0) {
        result.push(currentWeekDays);
        currentWeekDays = [];
      }
      currentWeekDays.push(day);
      lastWeekNum = weekNum;
    }
    if (currentWeekDays.length > 0) result.push(currentWeekDays);
    return result;
  }, [days, currentYear, currentMonth]);

  const visibleDays = viewMode === 'week' ? (weeks[currentWeek] || []) : days;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const getEmployeeColor = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return '#999';
    const type = Object.values(EMPLOYMENT_TYPES).find(t => t.id === emp.type);
    return type?.color || '#999';
  };

  const handleCellClick = (dateStr, hour) => {
    if (!selectedEmployee) return;
    if (selectedShift) {
      onAssignShift(dateStr, selectedEmployee, selectedShift);
    } else {
      const daySchedule = schedule[dateStr];
      const slot = daySchedule?.[`${hour}`] || [];
      if (slot.includes(selectedEmployee)) {
        onRemoveEmployee(dateStr, hour, selectedEmployee);
      } else {
        onAddEmployee(dateStr, hour, selectedEmployee);
      }
    }
  };

  const handleNameClick = (e, dateStr, hour, empId) => {
    e.stopPropagation();
    onRemoveEmployee(dateStr, hour, empId);
  };

  return (
    <div className="schedule-grid-wrapper">
      <div className="grid-controls">
        <div className="view-toggle">
          <button
            className={viewMode === 'month' ? 'active' : ''}
            onClick={() => setViewMode('month')}
          >
            월간
          </button>
          <button
            className={viewMode === 'week' ? 'active' : ''}
            onClick={() => setViewMode('week')}
          >
            주간
          </button>
        </div>
        {viewMode === 'week' && (
          <div className="week-nav">
            <button onClick={() => setCurrentWeek(Math.max(0, currentWeek - 1))} disabled={currentWeek === 0}>
              ◀ 이전 주
            </button>
            <span>{currentWeek + 1}주차</span>
            <button onClick={() => setCurrentWeek(Math.min(weeks.length - 1, currentWeek + 1))} disabled={currentWeek >= weeks.length - 1}>
              다음 주 ▶
            </button>
          </div>
        )}
      </div>

      <div className="schedule-grid" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th className="time-header">시간</th>
              {visibleDays.map(day => (
                <th
                  key={day.dateStr}
                  className={`day-header ${day.holiday ? 'holiday' : ''} ${day.dayOfWeek === 6 ? 'saturday' : ''}`}
                >
                  <div className="day-date">{day.date}</div>
                  <div className="day-name">{dayNames[day.dayOfWeek]}</div>
                  {day.holiday && <div className="holiday-name">{day.holiday.nameKo}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOT_KEYS.map(slotKey => (
              <tr key={slotKey}>
                <td className="time-cell">{formatLabel(slotKey)}</td>
                {visibleDays.map(day => {
                  const slot = schedule[day.dateStr]?.[slotKey] || [];
                  return (
                    <td
                      key={`${day.dateStr}-${slotKey}`}
                      className={`schedule-cell ${day.holiday ? 'holiday-cell' : ''} ${selectedEmployee ? 'clickable' : ''}`}
                      onClick={() => handleCellClick(day.dateStr, slotKey)}
                    >
                      {slot.map(empId => {
                        const emp = employees.find(e => e.id === empId);
                        return (
                          <span
                            key={empId}
                            className="employee-chip"
                            style={{ backgroundColor: getEmployeeColor(empId), color: '#fff' }}
                            onClick={(e) => handleNameClick(e, day.dateStr, slotKey, empId)}
                            title={`${emp?.name || empId} — 클릭하여 제거`}
                          >
                            {emp?.name || empId}
                          </span>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
