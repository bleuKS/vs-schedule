import { useState, useEffect, useRef, useCallback } from 'react';
import { useSchedule } from './hooks/useSchedule';
import ScheduleGrid from './components/ScheduleGrid';
import Toolbar from './components/Toolbar';
import EmployeePanel from './components/EmployeePanel';
import ValidationPanel from './components/ValidationPanel';
import Dashboard from './components/Dashboard';
import CalendarSync from './components/CalendarSync';
import LoginScreen, { checkAuth, logout } from './components/LoginScreen';
import { CAFE_SLOT_KEYS } from './data/shiftTypes';
import './App.css';

function App() {
  const [role, setRole] = useState(() => checkAuth());
  const logoutHandlerRef = useRef(null);

  if (!role) {
    return <LoginScreen onLogin={setRole} />;
  }

  const handleLogout = async () => {
    if (logoutHandlerRef.current) {
      await logoutHandlerRef.current();
    }
    logout();
    setRole(null);
  };

  return (
    <ScheduleApp
      role={role}
      onLogout={handleLogout}
      registerLogoutFlush={(fn) => { logoutHandlerRef.current = fn; }}
    />
  );
}


function ScheduleApp({ role, onLogout, registerLogoutFlush }) {
  const isReadOnly = role !== 'admin';

  // 최상위 year/month — 매장/카페 공유
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(3);

  const handleYearMonthChange = useCallback((y, m) => {
    setCurrentYear(y);
    setCurrentMonth(m);
  }, []);

  // 매장 스케줄 훅 (직원 관리 포함)
  const store = useSchedule({
    scope: 'store',
    externalYear: currentYear,
    externalMonth: currentMonth,
    onYearMonthChange: handleYearMonthChange,
    manageEmployees: true,
  });

  // 카페 스케줄 훅 (직원 공유)
  const cafe = useSchedule({
    scope: 'cafe',
    externalYear: currentYear,
    externalMonth: currentMonth,
    onYearMonthChange: handleYearMonthChange,
    manageEmployees: false,
  });

  // 두 스코프 flush를 하나로 묶어 로그아웃에 등록
  const combinedFlush = useCallback(async () => {
    await Promise.all([store.flushPendingSave(), cafe.flushPendingSave()]);
  }, [store.flushPendingSave, cafe.flushPendingSave]);

  useEffect(() => {
    if (registerLogoutFlush) registerLogoutFlush(combinedFlush);
  }, [registerLogoutFlush, combinedFlush]);

  // 선택 상태는 섹션별로 분리
  const [storeSelEmp, setStoreSelEmp] = useState(null);
  const [storeSelShift, setStoreSelShift] = useState(null);
  const [cafeSelEmp, setCafeSelEmp] = useState(null);
  const [cafeSelShift, setCafeSelShift] = useState(null);

  const [activeTab, setActiveTab] = useState('schedule');

  // 매장 기준 undo/redo 단축키 (주 작업 영역)
  useEffect(() => {
    if (isReadOnly) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        store.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        store.redo();
      }
      if (e.key === 'Escape') {
        setStoreSelEmp(null); setStoreSelShift(null);
        setCafeSelEmp(null); setCafeSelShift(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.undo, store.redo, isReadOnly]);

  const handleImport = (data) => {
    if (isReadOnly) return;
    if (data.schedule) store.replaceSchedule(data.schedule);
    if (data.employees) store.setEmployees(data.employees);
    if (data.shiftTypes) store.setShiftTypes(data.shiftTypes);
  };

  if (store.loading || cafe.loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">데이터 로딩 중...</div>
      </div>
    );
  }

  // 매장 저장 상태를 대표로 Toolbar 표시 (카페는 조용히 저장)
  return (
    <div className="app">
      <Toolbar
        currentYear={currentYear}
        setCurrentYear={setCurrentYear}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        schedule={store.schedule}
        employees={store.employees}
        shiftTypes={store.shiftTypes}
        onImport={handleImport}
        onUndo={store.undo}
        onRedo={store.redo}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        isReadOnly={isReadOnly}
        role={role}
        onLogout={onLogout}
        saveStatus={store.saveStatus === 'error' || cafe.saveStatus === 'error'
          ? 'error'
          : store.saveStatus === 'saving' || cafe.saveStatus === 'saving'
            ? 'saving'
            : store.saveStatus}
        lastSavedAt={store.lastSavedAt}
        saveError={store.saveError || cafe.saveError}
        onManualSave={combinedFlush}
      />

      <div className="tab-bar">
        <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>
          스케줄
        </button>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          대시보드
        </button>
        <button className={activeTab === 'validation' ? 'active' : ''} onClick={() => setActiveTab('validation')}>
          법규 검증
        </button>
        {!isReadOnly && (
          <button className={activeTab === 'calendar' ? 'active' : ''} onClick={() => setActiveTab('calendar')}>
            캘린더 연동
          </button>
        )}
      </div>

      {isReadOnly && (
        <div className="readonly-banner">읽기 전용 모드 -- 스케줄 확인만 가능합니다</div>
      )}

      <div className="main-content">
        {activeTab === 'schedule' && (
          <>
            {/* 매장 섹션 (0층/1층) */}
            <div className="section-header">
              <h2>매장 (0층/1층) · 08:00 ~ 20:00</h2>
            </div>
            <div className="schedule-layout">
              {!isReadOnly && (
                <EmployeePanel
                  employees={store.employees}
                  setEmployees={store.setEmployees}
                  selectedEmployee={storeSelEmp}
                  setSelectedEmployee={setStoreSelEmp}
                  shiftTypes={store.shiftTypes}
                  selectedShift={storeSelShift}
                  setSelectedShift={setStoreSelShift}
                  filterLocation="store"
                />
              )}
              <ScheduleGrid
                schedule={store.schedule}
                employees={store.employees}
                shiftTypes={store.shiftTypes}
                currentYear={currentYear}
                currentMonth={currentMonth}
                hourStart={8}
                hourEnd={20}
                onAddEmployee={isReadOnly ? () => {} : store.addEmployeeToSlot}
                onRemoveEmployee={isReadOnly ? () => {} : store.removeEmployeeFromSlot}
                onAssignShift={isReadOnly ? () => {} : store.assignShift}
                onClearDay={isReadOnly ? () => {} : store.clearEmployeeDay}
                selectedEmployee={isReadOnly ? null : storeSelEmp}
                setSelectedEmployee={isReadOnly ? () => {} : setStoreSelEmp}
                selectedShift={isReadOnly ? null : storeSelShift}
              />
            </div>

            {/* 카페 섹션 */}
            <div className="section-header cafe-header">
              <h2>카페 · 10:30 ~ 19:30</h2>
            </div>
            <div className="schedule-layout">
              {!isReadOnly && (
                <EmployeePanel
                  employees={store.employees}
                  setEmployees={store.setEmployees}
                  selectedEmployee={cafeSelEmp}
                  setSelectedEmployee={setCafeSelEmp}
                  shiftTypes={cafe.shiftTypes}
                  selectedShift={cafeSelShift}
                  setSelectedShift={setCafeSelShift}
                  filterLocation="cafe"
                />
              )}
              <ScheduleGrid
                schedule={cafe.schedule}
                employees={store.employees}
                shiftTypes={cafe.shiftTypes}
                currentYear={currentYear}
                currentMonth={currentMonth}
                slots={CAFE_SLOT_KEYS}
                onAddEmployee={isReadOnly ? () => {} : cafe.addEmployeeToSlot}
                onRemoveEmployee={isReadOnly ? () => {} : cafe.removeEmployeeFromSlot}
                onAssignShift={isReadOnly ? () => {} : cafe.assignShift}
                onClearDay={isReadOnly ? () => {} : cafe.clearEmployeeDay}
                selectedEmployee={isReadOnly ? null : cafeSelEmp}
                setSelectedEmployee={isReadOnly ? () => {} : setCafeSelEmp}
                selectedShift={isReadOnly ? null : cafeSelShift}
              />
            </div>
          </>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            schedule={store.schedule}
            employees={store.employees}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationPanel
            schedule={store.schedule}
            employees={store.employees}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}

        {activeTab === 'calendar' && !isReadOnly && (
          <div className="calendar-sync-wrapper">
            <CalendarSync
              schedule={store.schedule}
              employees={store.employees}
              currentYear={currentYear}
              currentMonth={currentMonth}
              location="store"
              label="매장"
              hourRange={[8, 20]}
            />
            <div style={{ height: 24 }} />
            <CalendarSync
              schedule={cafe.schedule}
              employees={store.employees}
              currentYear={currentYear}
              currentMonth={currentMonth}
              location="cafe"
              label="카페"
              hourRange={[10, 20]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
