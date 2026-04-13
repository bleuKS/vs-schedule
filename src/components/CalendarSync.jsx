import { useState } from 'react';
import { EMPLOYMENT_TYPES } from '../data/employees';

export default function CalendarSync({ schedule, employees, currentYear, currentMonth }) {
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState([]);
  const [calendarId, setCalendarId] = useState('');

  const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  // 스케줄 데이터를 이벤트 목록으로 변환
  const generateEvents = (employeeId = null) => {
    const events = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const targetEmployees = employeeId
      ? employees.filter(e => e.id === employeeId)
      : employees;

    for (const emp of targetEmployees) {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(currentYear, currentMonth, d);
        if (date.getDay() === 0) continue;

        // 연속 근무 시간대 찾기
        const hours = [];
        for (let h = 8; h < 20; h++) {
          const slot = schedule[dateStr]?.[`${h}`] || [];
          if (slot.includes(emp.id)) hours.push(h);
        }

        if (hours.length === 0) continue;

        // 연속 블록으로 그룹핑
        const blocks = [];
        let blockStart = hours[0];
        let blockEnd = hours[0] + 1;

        for (let i = 1; i < hours.length; i++) {
          if (hours[i] === blockEnd) {
            blockEnd = hours[i] + 1;
          } else {
            blocks.push({ start: blockStart, end: blockEnd });
            blockStart = hours[i];
            blockEnd = hours[i] + 1;
          }
        }
        blocks.push({ start: blockStart, end: blockEnd });

        for (const block of blocks) {
          events.push({
            summary: `${emp.name} 근무`,
            start: {
              dateTime: `${dateStr}T${String(block.start).padStart(2, '0')}:00:00`,
              timeZone: 'Europe/Berlin',
            },
            end: {
              dateTime: `${dateStr}T${String(block.end).padStart(2, '0')}:00:00`,
              timeZone: 'Europe/Berlin',
            },
            description: `바이브서울 매장 근무\n직원: ${emp.name}\n유형: ${Object.values(EMPLOYMENT_TYPES).find(t => t.id === emp.type)?.label || emp.type}`,
            employeeId: emp.id,
          });
        }
      }
    }

    return events;
  };

  const handleGeneratePreview = () => {
    const events = generateEvents();
    addLog(`총 ${events.length}개 이벤트 생성 예정`);
    const byEmployee = {};
    for (const ev of events) {
      if (!byEmployee[ev.employeeId]) byEmployee[ev.employeeId] = 0;
      byEmployee[ev.employeeId]++;
    }
    for (const [id, count] of Object.entries(byEmployee)) {
      const emp = employees.find(e => e.id === id);
      addLog(`  ${emp?.name || id}: ${count}개 이벤트`);
    }
  };

  // 이벤트 데이터를 JSON으로 내보내기 (GCal API 연동용)
  const handleExportEvents = () => {
    const events = generateEvents();
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcal-events-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('이벤트 JSON 파일 내보내기 완료');
  };

  return (
    <div className="calendar-sync">
      <h3>구글캘린더 연동</h3>

      <div className="sync-section">
        <div className="sync-actions">
          <button onClick={handleGeneratePreview}>
            이벤트 미리보기
          </button>
          <button onClick={handleExportEvents}>
            이벤트 JSON 내보내기
          </button>
        </div>

        <div className="sync-info">
          <p>구글캘린더 동기화는 JSON 내보내기 후 별도 실행합니다.</p>
          <p>매장 공유 캘린더 + 직원 개인 캘린더 모두 지원.</p>
        </div>
      </div>

      {log.length > 0 && (
        <div className="sync-log">
          <h4>로그</h4>
          <div className="log-content">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <button className="clear-log" onClick={() => setLog([])}>로그 지우기</button>
        </div>
      )}
    </div>
  );
}
