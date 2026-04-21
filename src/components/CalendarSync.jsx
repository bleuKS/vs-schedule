import { useState, useCallback } from 'react';
import { EMPLOYMENT_TYPES } from '../data/employees';
import { parseSlotKey, slotDurationMinutes } from '../data/shiftTypes';

const GOOGLE_CLIENT_ID = '12468203885-0f6spsu7e2shff3a8c1sbca5tkjcfu6s.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const PROP_TAG = 'vibeseoulSchedule'; // extendedProperties.private 태그 키 (값 = YYYY-MM[-cafe])

// 분 → "HH:MM:00" 문자열
function minutesToTimeStr(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

let tokenClient = null;
let accessToken = null;

function initGoogleAuth() {
  return new Promise((resolve) => {
    if (tokenClient) { resolve(); return; }
    if (!document.getElementById('gis-script')) {
      const script = document.createElement('script');
      script.id = 'gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: () => {},
        });
        resolve();
      };
      document.head.appendChild(script);
    } else {
      resolve();
    }
  });
}

function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Google Auth 미초기화')); return; }
    tokenClient.callback = (response) => {
      if (response.error) { reject(response); return; }
      accessToken = response.access_token;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken();
  });
}

async function createCalendarEvent(event) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      extendedProperties: event.extendedProperties,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'API 오류');
  }
  return res.json();
}

// 주어진 year-month 태그가 달린 바이브서울 이벤트 전부 조회 (페이지네이션 대응)
async function listExistingEvents(yearMonth) {
  const items = [];
  let pageToken = null;
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('privateExtendedProperty', `${PROP_TAG}=${yearMonth}`);
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('showDeleted', 'false');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || '이벤트 조회 실패');
    }
    const data = await res.json();
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return items;
}

async function deleteCalendarEvent(eventId) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  // 204 No Content 또는 410 Gone(이미 삭제됨) 모두 성공 처리
  if (!res.ok && res.status !== 410) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `삭제 실패 (${res.status})`);
  }
}

export default function CalendarSync({
  schedule,
  employees,
  currentYear,
  currentMonth,
  location = 'store', // 'store' | 'cafe'
  label,
  hourRange,
}) {
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [replaceMode, setReplaceMode] = useState(true);

  const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  const scopeTag = location === 'cafe'
    ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cafe`
    : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const yearMonth = scopeTag;
  const displayLabel = label || (location === 'cafe' ? '카페' : '매장');
  // hourRange는 현재 사용하지 않음 (분 단위 슬롯 키로 직접 계산). prop은 후방 호환 위해 유지.
  void hourRange;

  const generateEvents = useCallback(() => {
    const events = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (const emp of employees) {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(currentYear, currentMonth, d);
        if (date.getDay() === 0) continue;

        // 이 직원이 들어있는 모든 슬롯 키 수집 (분 단위 포함)
        const daySchedule = schedule[dateStr] || {};
        const intervals = Object.keys(daySchedule)
          .filter(key => Array.isArray(daySchedule[key]) && daySchedule[key].includes(emp.id))
          .map(key => {
            const { totalMin } = parseSlotKey(key);
            return {
              key,
              startMin: totalMin,
              endMin: totalMin + slotDurationMinutes(key),
            };
          })
          .sort((a, b) => a.startMin - b.startMin);

        if (intervals.length === 0) continue;

        // 연속 블록으로 묶기 (이전 endMin == 다음 startMin)
        const blocks = [];
        let cur = { startMin: intervals[0].startMin, endMin: intervals[0].endMin };
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i].startMin === cur.endMin) {
            cur.endMin = intervals[i].endMin;
          } else {
            blocks.push(cur);
            cur = { startMin: intervals[i].startMin, endMin: intervals[i].endMin };
          }
        }
        blocks.push(cur);

        for (const block of blocks) {
          events.push({
            summary: `${emp.name} ${displayLabel} 근무`,
            start: {
              dateTime: `${dateStr}T${minutesToTimeStr(block.startMin)}`,
              timeZone: 'Europe/Berlin',
            },
            end: {
              dateTime: `${dateStr}T${minutesToTimeStr(block.endMin)}`,
              timeZone: 'Europe/Berlin',
            },
            description: `바이브서울 ${displayLabel} 근무\n직원: ${emp.name}\n유형: ${Object.values(EMPLOYMENT_TYPES).find(t => t.id === emp.type)?.label || emp.type}`,
            employeeId: emp.id,
            extendedProperties: {
              private: {
                [PROP_TAG]: yearMonth,
                vibeseoulLoc: location,
                vibeseoulEmp: emp.id,
                vibeseoulDate: dateStr,
                vibeseoulBlock: `${block.startMin}-${block.endMin}`,
              },
            },
          });
        }
      }
    }
    return events;
  }, [schedule, employees, currentYear, currentMonth, yearMonth, location, displayLabel]);

  const handlePreview = () => {
    const events = generateEvents();
    addLog(`총 ${events.length}개 이벤트 생성 예정 (${yearMonth})`);
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

  const handleGoogleLogin = async () => {
    try {
      addLog('구글 인증 시작...');
      await initGoogleAuth();
      await requestAccessToken();
      setAuthenticated(true);
      addLog('구글 인증 성공');
    } catch (err) {
      addLog(`인증 실패: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleDeleteExisting = async () => {
    if (!accessToken) { addLog('먼저 구글 로그인을 해주세요.'); return; }
    if (!window.confirm(`${yearMonth} 월의 바이브서울 이벤트를 모두 삭제할까요?`)) return;
    setSyncing(true);
    try {
      addLog(`${yearMonth} 기존 이벤트 조회 중...`);
      const existing = await listExistingEvents(yearMonth);
      addLog(`기존 ${existing.length}개 이벤트 삭제 시작`);
      setProgress({ current: 0, total: existing.length });
      let deleted = 0, failed = 0;
      for (let i = 0; i < existing.length; i++) {
        try {
          await deleteCalendarEvent(existing[i].id);
          deleted++;
        } catch (err) {
          failed++;
          addLog(`삭제 실패: ${existing[i].summary} - ${err.message}`);
        }
        setProgress({ current: i + 1, total: existing.length });
        if ((i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 200));
      }
      addLog(`삭제 완료: ${deleted}개 성공, ${failed}개 실패`);
    } catch (err) {
      addLog(`조회 실패: ${err.message}`);
    }
    setSyncing(false);
  };

  const handleSync = async () => {
    if (!accessToken) {
      addLog('먼저 구글 로그인을 해주세요.');
      return;
    }

    const events = generateEvents();
    if (events.length === 0) {
      addLog('동기화할 이벤트가 없습니다.');
      return;
    }

    setSyncing(true);

    // 1단계: 기존 이벤트 삭제 (대체 모드일 때)
    if (replaceMode) {
      try {
        addLog(`${yearMonth} 기존 바이브서울 이벤트 조회...`);
        const existing = await listExistingEvents(yearMonth);
        if (existing.length > 0) {
          addLog(`기존 ${existing.length}개 이벤트 삭제 중...`);
          setProgress({ current: 0, total: existing.length });
          let delFail = 0;
          for (let i = 0; i < existing.length; i++) {
            try {
              await deleteCalendarEvent(existing[i].id);
            } catch (err) {
              delFail++;
              addLog(`삭제 실패: ${existing[i].summary} - ${err.message}`);
            }
            setProgress({ current: i + 1, total: existing.length });
            if ((i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 200));
          }
          addLog(`기존 이벤트 삭제: ${existing.length - delFail}/${existing.length}`);
        } else {
          addLog('기존 바이브서울 이벤트 없음 (신규 게시)');
        }
      } catch (err) {
        addLog(`기존 이벤트 조회 실패: ${err.message} — 생성은 계속 진행`);
      }
    } else {
      addLog('경고: 대체 모드 꺼짐 — 중복 이벤트가 생길 수 있습니다');
    }

    // 2단계: 신규 이벤트 생성
    setProgress({ current: 0, total: events.length });
    addLog(`${events.length}개 이벤트 생성 시작...`);
    let success = 0, failed = 0;
    for (let i = 0; i < events.length; i++) {
      try {
        await createCalendarEvent(events[i]);
        success++;
      } catch (err) {
        failed++;
        addLog(`실패: ${events[i].summary} (${events[i].start.dateTime}) - ${err.message}`);
      }
      setProgress({ current: i + 1, total: events.length });
      if ((i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 200));
    }
    addLog(`동기화 완료: ${success}개 성공, ${failed}개 실패`);
    setSyncing(false);
  };

  const handleExportJSON = () => {
    const events = generateEvents();
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcal-events-${yearMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('이벤트 JSON 파일 내보내기 완료');
  };

  return (
    <div className="calendar-sync">
      <h3>구글캘린더 연동 — {displayLabel} ({yearMonth}, Europe/Berlin)</h3>

      <div className="sync-section">
        <div className="sync-steps">
          <div className={`sync-step ${authenticated ? 'done' : ''}`}>
            <span className="step-num">1</span>
            <span className="step-text">구글 계정 연결</span>
            {!authenticated ? (
              <button className="google-login-btn" onClick={handleGoogleLogin}>
                구글 로그인
              </button>
            ) : (
              <span className="step-done">연결됨</span>
            )}
          </div>

          <div className="sync-step">
            <span className="step-num">2</span>
            <span className="step-text">이벤트 확인</span>
            <button onClick={handlePreview}>미리보기</button>
          </div>

          <div className="sync-step">
            <span className="step-num">3</span>
            <span className="step-text">캘린더에 동기화</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10 }}>
              <input
                type="checkbox"
                checked={replaceMode}
                onChange={(e) => setReplaceMode(e.target.checked)}
                disabled={syncing}
              />
              <span>재게시 시 기존 이벤트 대체</span>
            </label>
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={!authenticated || syncing}
            >
              {syncing ? `처리 중... (${progress.current}/${progress.total})` : '캘린더 동기화'}
            </button>
          </div>
        </div>

        {syncing && (
          <div className="sync-progress">
            <div
              className="sync-progress-bar"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%` }}
            />
          </div>
        )}

        <div className="sync-extra">
          <button onClick={handleExportJSON}>JSON 내보내기</button>
          <button
            onClick={handleDeleteExisting}
            disabled={!authenticated || syncing}
            style={{ marginLeft: 8 }}
          >
            {yearMonth} 기존 이벤트만 삭제
          </button>
        </div>

        <p className="sync-hint" style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
          * 대체 모드가 켜져 있으면 {yearMonth} 월의 기존 바이브서울 이벤트(`{PROP_TAG}={yearMonth}` 태그)를 삭제 후 새로 생성합니다.
          스케줄 수정 후 다시 게시해도 중복이 발생하지 않습니다.
          이벤트 시각은 Europe/Berlin 기준으로 전송되어 구글 캘린더가 DST(썸머타임)를 자동 처리합니다.
        </p>
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
