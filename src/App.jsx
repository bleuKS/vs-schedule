import { useState, useEffect } from 'react';
import { useSchedule } from './hooks/useSchedule';
import ScheduleGrid from './components/ScheduleGrid';
import Toolbar from './components/Toolbar';
import EmployeePanel from './components/EmployeePanel';
import ValidationPanel from './components/ValidationPanel';
import Dashboard from './components/Dashboard';
import CalendarSync from './components/CalendarSync';
import LoginScreen, { checkAuth, logout } from './components/LoginScreen';
import './App.css';

function App() {
  const [role, setRole] = useState(() => checkAuth()); // 'admin' | 'viewer' | null

  if (!role) {
    return <LoginScreen onLogin={setRole} />;
  }

  return <ScheduleApp role={role} onLogout={() => { logout(); setRole(null); }} />;
}

function ScheduleApp({ role, onLogout }) {
  const isReadOnly = role !== 'admin';

  const {
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
    canUndo,
    canRedo,
    replaceSchedule,
    loading,
  } = useSchedule();

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');

  useEffect(() => {
    if (isReadOnly) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Escape') {
        setSelectedEmployee(null);
        setSelectedShift(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, isReadOnly]);

  const handleImport = (data) => {
    if (isReadOnly) return;
    if (data.schedule) replaceSchedule(data.schedule);
    if (data.employees) setEmployees(data.employees);
    if (data.shiftTypes) setShiftTypes(data.shiftTypes);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Toolbar
        currentYear={currentYear}
        setCurrentYear={setCurrentYear}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        schedule={schedule}
        employees={employees}
        shiftTypes={shiftTypes}
        onImport={handleImport}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isReadOnly={isReadOnly}
        role={role}
        onLogout={onLogout}
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
          <div className="schedule-layout">
            {!isReadOnly && (
              <EmployeePanel
                employees={employees}
                setEmployees={setEmployees}
                selectedEmployee={selectedEmployee}
                setSelectedEmployee={setSelectedEmployee}
                shiftTypes={shiftTypes}
                selectedShift={selectedShift}
                setSelectedShift={setSelectedShift}
              />
            )}
            <ScheduleGrid
              schedule={schedule}
              employees={employees}
              shiftTypes={shiftTypes}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onAddEmployee={isReadOnly ? () => {} : addEmployeeToSlot}
              onRemoveEmployee={isReadOnly ? () => {} : removeEmployeeFromSlot}
              onAssignShift={isReadOnly ? () => {} : assignShift}
              onClearDay={isReadOnly ? () => {} : clearEmployeeDay}
              selectedEmployee={isReadOnly ? null : selectedEmployee}
              setSelectedEmployee={isReadOnly ? () => {} : setSelectedEmployee}
              selectedShift={isReadOnly ? null : selectedShift}
            />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            schedule={schedule}
            employees={employees}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationPanel
            schedule={schedule}
            employees={employees}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}

        {activeTab === 'calendar' && !isReadOnly && (
          <CalendarSync
            schedule={schedule}
            employees={employees}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}
      </div>
    </div>
  );
}

export default App;
