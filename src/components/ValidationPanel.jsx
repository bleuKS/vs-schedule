import { useMemo } from 'react';
import { validateSchedule, SEVERITY } from '../utils/validation';

export default function ValidationPanel({ schedule, employees, currentYear, currentMonth }) {
  const warnings = useMemo(
    () => validateSchedule(schedule, employees, currentYear, currentMonth),
    [schedule, employees, currentYear, currentMonth]
  );

  const errors = warnings.filter(w => w.severity === SEVERITY.ERROR);
  const warningsList = warnings.filter(w => w.severity === SEVERITY.WARNING);

  if (warnings.length === 0) {
    return (
      <div className="validation-panel clean">
        <h3>법규 검증</h3>
        <p className="all-clear">모든 검증 통과</p>
      </div>
    );
  }

  return (
    <div className="validation-panel">
      <h3>
        법규 검증
        {errors.length > 0 && <span className="error-count">{errors.length} 오류</span>}
        {warningsList.length > 0 && <span className="warning-count">{warningsList.length} 경고</span>}
      </h3>

      {errors.length > 0 && (
        <div className="validation-section errors">
          <h4>오류 (반드시 수정 필요)</h4>
          {errors.map((w, i) => (
            <div key={i} className="validation-item error">
              <span className="badge error-badge">ERROR</span>
              <span className="rule">{w.rule}</span>
              <span className="message">{w.message}</span>
              <span className="date">{w.date}</span>
            </div>
          ))}
        </div>
      )}

      {warningsList.length > 0 && (
        <div className="validation-section warnings">
          <h4>경고 (확인 필요)</h4>
          {warningsList.map((w, i) => (
            <div key={i} className="validation-item warning">
              <span className="badge warning-badge">WARNING</span>
              <span className="rule">{w.rule}</span>
              <span className="message">{w.message}</span>
              <span className="date">{w.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
