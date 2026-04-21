import { exportToJSON, importFromJSON, exportToCSV } from '../utils/storage';

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function Toolbar({
  currentYear,
  setCurrentYear,
  currentMonth,
  setCurrentMonth,
  schedule,
  employees,
  shiftTypes,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isReadOnly = false,
  role = 'admin',
  onLogout,
  saveStatus = 'idle',
  lastSavedAt = null,
  saveError = null,
  onManualSave,
}) {
  const saveLabel = (() => {
    switch (saveStatus) {
      case 'saving': return '저장 중...';
      case 'saved': return lastSavedAt
        ? `저장됨 · ${lastSavedAt.toLocaleTimeString('ko-KR', { timeZone: 'Europe/Berlin' })} (DE)`
        : '저장됨';
      case 'error': return `저장 실패 — ${saveError || '재시도'}`;
      default: return lastSavedAt
        ? `최근 저장 ${lastSavedAt.toLocaleTimeString('ko-KR', { timeZone: 'Europe/Berlin' })} (DE)`
        : '대기';
    }
  })();
  const handleExportJSON = () => {
    exportToJSON(schedule, employees, shiftTypes);
  };

  const handleExportCSV = () => {
    exportToCSV(schedule, employees, currentYear, currentMonth);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await importFromJSON(file);
      onImport(data);
    } catch (err) {
      alert(err.message);
    }
    e.target.value = '';
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <h1>바이브서울 스케줄 관리</h1>
        <div className="month-nav">
          <button onClick={prevMonth}>◀</button>
          <span className="current-month">{currentYear}년 {MONTH_NAMES[currentMonth]}</span>
          <button onClick={nextMonth}>▶</button>
        </div>
      </div>
      <div className="toolbar-right">
        {!isReadOnly && (
          <>
            <button onClick={onUndo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)">
              되돌리기
            </button>
            <button onClick={onRedo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)">
              다시 실행
            </button>
            <button onClick={handleExportJSON}>JSON 내보내기</button>
            <button onClick={handleExportCSV}>CSV 내보내기</button>
            <label className="import-btn">
              JSON 가져오기
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </>
        )}
        <span
          className={`save-status save-status-${saveStatus}`}
          title={saveError || saveLabel}
          onClick={saveStatus === 'error' && onManualSave ? onManualSave : undefined}
          role={saveStatus === 'error' ? 'button' : undefined}
        >
          <span className="save-dot" />
          {saveLabel}
        </span>
        <span className="role-badge">{role === 'admin' ? '관리자' : '뷰어'}</span>
        <button className="logout-btn" onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  );
}
