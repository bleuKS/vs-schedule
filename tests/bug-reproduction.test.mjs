// 수정 전 버그 재현 테스트 (반증 테스트).
//
// 수정된 hook이 아니라 '수정 전' 로직을 그대로 구현한 뒤,
// "월 전환 race"가 실제로 초기화를 일으키는지 재현해 본다.
// 이 테스트는 반드시 '실패(버그 재현)'해야 패치가 올바른 타깃을 잡은 것임을 확인한다.

import assert from 'node:assert/strict';

const db = new Map();

async function loadScheduleFromDB(yearMonth) {
  if (!db.has(yearMonth)) return null;
  return db.get(yearMonth);
}

async function saveScheduleToDB(schedule, yearMonth) {
  db.set(yearMonth, schedule);
  return { ok: true };
}

// --- BUGGY hook (수정 전 로직 복원) ---
function createBuggyHook() {
  let schedule = {};
  let yearMonth = null;
  let loading = true;
  const saveTimer = { id: null };
  const pendingRef = { current: null };
  const firstSkipRef = { current: true };

  async function loadMonth(newYearMonth) {
    loading = true;
    yearMonth = newYearMonth;
    const data = await loadScheduleFromDB(newYearMonth);
    schedule = data || {};
    loading = false;
    firstSkipRef.current = true; // reset skip (수정 전 별도 effect 역할)
    runSaveEffect(); // post-load 재렌더
  }

  function edit(dateStr, slotKey, empId) {
    if (loading) return;
    const day = schedule[dateStr] || {};
    const slot = day[slotKey] || [];
    if (!slot.includes(empId)) {
      schedule = { ...schedule, [dateStr]: { ...day, [slotKey]: [...slot, empId] } };
    }
    runSaveEffect();
  }

  // 수정 전: loadedYearMonthRef 체크 없음
  function runSaveEffect() {
    if (loading) return;
    if (firstSkipRef.current) {
      firstSkipRef.current = false;
      return;
    }
    pendingRef.current = { schedule, yearMonth };
    if (saveTimer.id) clearTimeout(saveTimer.id);
    saveTimer.id = setTimeout(async () => {
      const p = pendingRef.current;
      if (!p) return;
      await saveScheduleToDB(p.schedule, p.yearMonth);
      pendingRef.current = null;
    }, 50);
  }

  // 수정 전: loadMonth 에서도 같은 render 사이클 내에 save effect가 먼저 실행됨.
  // 이를 흉내내기 위해 별도 메서드 제공.
  function simulateMonthChangeRace(newYearMonth) {
    // 이것이 수정 전 React 동작의 핵심:
    // (1) yearMonth만 먼저 바뀌고, schedule은 아직 이전 월 데이터
    // (2) save effect가 이 render에서 발동되어 "이전 schedule + 새 yearMonth"로 저장 예약
    // (3) 그 다음에 load effect가 fetch 시작
    const oldYearMonth = yearMonth;
    yearMonth = newYearMonth; // render 1: yearMonth만 변경
    runSaveEffect(); // ← 이 시점에 schedule은 oldMonth 데이터, yearMonth는 new
    // 그 다음 load effect가 실제로 실행:
    return loadMonth(newYearMonth);
  }

  return { loadMonth, edit, simulateMonthChangeRace };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function reproduce_bug() {
  db.clear();
  db.set('2026-01', { '2026-01-05': { '8': ['janUser'] } });
  db.set('2026-02', { '2026-02-10': { '9': ['febUser'] } });

  const hook = createBuggyHook();
  await hook.loadMonth('2026-01');
  hook.edit('2026-01-06', '10', 'edited');

  // 월 전환 race 발생
  await hook.simulateMonthChangeRace('2026-02');
  await wait(150); // debounce 통과

  const feb = db.get('2026-02');
  // 버그가 있다면 feb는 1월 데이터로 덮어써짐
  // 이 assert는 '버그가 없다'는 가정 — 수정 전 코드라 실패해야 맞음
  try {
    assert.deepEqual(feb, { '2026-02-10': { '9': ['febUser'] } });
    console.log('⚠️ 버그가 재현되지 않음 — 시뮬레이션 모델 재검토 필요');
    return false;
  } catch {
    console.log('✅ 수정 전 코드에서 월 전환 race 재현 확인 (2월 데이터가 1월 데이터로 덮어써짐)');
    console.log('   실제 DB 2월 상태:', JSON.stringify(feb));
    return true;
  }
}

(async () => {
  const reproduced = await reproduce_bug();
  process.exit(reproduced ? 0 : 1);
})();
