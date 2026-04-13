import { useState } from 'react';
import { EMPLOYMENT_TYPES } from '../data/employees';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function EmployeePanel({
  employees,
  setEmployees,
  selectedEmployee,
  setSelectedEmployee,
  shiftTypes,
  selectedShift,
  setSelectedShift,
}) {
  const [showManager, setShowManager] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const getTypeInfo = (typeId) =>
    Object.values(EMPLOYMENT_TYPES).find(t => t.id === typeId);

  const handleSelect = (empId) => {
    setSelectedEmployee(selectedEmployee === empId ? null : empId);
  };

  const handleShiftSelect = (shift) => {
    setSelectedShift(selectedShift?.id === shift.id ? null : shift);
  };

  const handleSaveEmployee = (emp) => {
    setEmployees(prev =>
      prev.map(e => e.id === emp.id ? emp : e)
    );
    setEditingEmployee(null);
  };

  const handleAddEmployee = () => {
    const id = `emp-${Date.now()}`;
    const newEmp = {
      id,
      name: '새 직원',
      displayName: '새 직원',
      type: 'minijob',
      dayOff: null,
      isMinor: false,
      contractHours: null,
      notes: '',
    };
    setEmployees(prev => [...prev, newEmp]);
    setEditingEmployee(newEmp);
  };

  const handleDeleteEmployee = (empId) => {
    if (!confirm('이 직원을 삭제하시겠습니까?')) return;
    setEmployees(prev => prev.filter(e => e.id !== empId));
    if (selectedEmployee === empId) setSelectedEmployee(null);
  };

  // 유형별로 그룹화
  const groupedEmployees = {};
  for (const emp of employees) {
    const type = getTypeInfo(emp.type);
    const label = type?.label || emp.type;
    if (!groupedEmployees[label]) groupedEmployees[label] = [];
    groupedEmployees[label].push(emp);
  }

  return (
    <div className="employee-panel">
      <div className="panel-section">
        <h3>직원 선택</h3>
        <p className="hint">
          {selectedEmployee
            ? `[${employees.find(e => e.id === selectedEmployee)?.name}] 선택됨 — 그리드 셀 클릭하여 배정/해제`
            : '직원을 선택한 후 그리드 셀을 클릭하세요'}
        </p>

        {Object.entries(groupedEmployees).map(([label, emps]) => (
          <div key={label} className="employee-group">
            <h4>{label}</h4>
            <div className="employee-list">
              {emps.map(emp => {
                const typeInfo = getTypeInfo(emp.type);
                return (
                  <button
                    key={emp.id}
                    className={`employee-btn ${selectedEmployee === emp.id ? 'selected' : ''}`}
                    style={{
                      borderColor: typeInfo?.color,
                      backgroundColor: selectedEmployee === emp.id ? typeInfo?.color : 'transparent',
                      color: selectedEmployee === emp.id ? '#fff' : typeInfo?.color,
                    }}
                    onClick={() => handleSelect(emp.id)}
                    title={emp.notes}
                  >
                    {emp.name}
                    {emp.dayOff !== null && <span className="day-off-badge">{DAY_NAMES[emp.dayOff]}휴</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section">
        <h3>시프트 타입</h3>
        <p className="hint">
          {selectedShift
            ? `[${selectedShift.name}] ${selectedShift.start}:00~${selectedShift.end}:00 — 직원 선택 후 날짜 클릭`
            : '시프트 선택 시 해당 시간대 일괄 배정'}
        </p>
        <div className="shift-list">
          <button
            className={`shift-btn ${!selectedShift ? 'selected' : ''}`}
            onClick={() => setSelectedShift(null)}
          >
            단일 시간 (수동)
          </button>
          {shiftTypes.map(shift => (
            <button
              key={shift.id}
              className={`shift-btn ${selectedShift?.id === shift.id ? 'selected' : ''}`}
              onClick={() => handleShiftSelect(shift)}
            >
              {shift.name} ({shift.start}:00~{shift.end}:00)
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <button className="manage-btn" onClick={() => setShowManager(!showManager)}>
          {showManager ? '직원 관리 닫기' : '직원 관리'}
        </button>

        {showManager && (
          <div className="employee-manager">
            <button className="add-btn" onClick={handleAddEmployee}>+ 직원 추가</button>
            {employees.map(emp => (
              <div key={emp.id} className="employee-edit-row">
                {editingEmployee?.id === emp.id ? (
                  <EmployeeEditForm
                    employee={editingEmployee}
                    onChange={setEditingEmployee}
                    onSave={handleSaveEmployee}
                    onCancel={() => setEditingEmployee(null)}
                  />
                ) : (
                  <div className="employee-info-row">
                    <span style={{ color: getTypeInfo(emp.type)?.color }}>
                      {emp.name}
                    </span>
                    <span className="emp-type-label">{getTypeInfo(emp.type)?.label}</span>
                    <button onClick={() => setEditingEmployee({ ...emp })}>수정</button>
                    <button className="delete-btn" onClick={() => handleDeleteEmployee(emp.id)}>삭제</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeEditForm({ employee, onChange, onSave, onCancel }) {
  const update = (field, value) => onChange({ ...employee, [field]: value });

  return (
    <div className="edit-form">
      <div className="form-row">
        <label>이름:</label>
        <input value={employee.name} onChange={e => update('name', e.target.value)} />
      </div>
      <div className="form-row">
        <label>표시명:</label>
        <input value={employee.displayName} onChange={e => update('displayName', e.target.value)} />
      </div>
      <div className="form-row">
        <label>유형:</label>
        <select value={employee.type} onChange={e => update('type', e.target.value)}>
          {Object.values(EMPLOYMENT_TYPES).map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>정기 휴무:</label>
        <select value={employee.dayOff ?? ''} onChange={e => update('dayOff', e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">없음</option>
          {[1, 2, 3, 4, 5, 6].map(d => (
            <option key={d} value={d}>{['', '월', '화', '수', '목', '금', '토'][d]}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>계약시간(주):</label>
        <input type="number" value={employee.contractHours || ''} onChange={e => update('contractHours', e.target.value ? Number(e.target.value) : null)} />
      </div>
      <div className="form-row">
        <label>미성년자:</label>
        <input type="checkbox" checked={employee.isMinor} onChange={e => update('isMinor', e.target.checked)} />
      </div>
      <div className="form-row">
        <label>메모:</label>
        <input value={employee.notes} onChange={e => update('notes', e.target.value)} />
      </div>
      <div className="form-actions">
        <button onClick={() => onSave(employee)}>저장</button>
        <button onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
