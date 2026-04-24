// 초기화 현상 회귀 테스트 (2026-04-25 KS 리포트 대응)
//
// 실행: node tests/regression.test.mjs
// 목적:
//   1) 월 전환 Race 재현 → 수정본에서 방지됨을 검증
//   2) 로드 실패(null) → 빈 데이터로 DB 덮어쓰지 않음을 검증
//   3) 빠른 월 전환(A→B→C) 중 이전 월 데이터 보존 검증
//   4) 빈 schedule 저장 방어층 단독 검증
//   5) pending save flush 시 월 키 일치 검증

import assert from 'node:assert/strict';

// --- In-memory DB + localStorage mock ---
const db = new Map();
const local = new Map();

function resetAll() {
  db.clear();
  local.clear();
}

// storage.js 의 핵심 로직 재현 ---------------------------------------------

function isEmptySchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return true;
  const keys = Object.keys(schedule);
  if (keys.length === 0) return true;
  return keys.every((dateKey) => {
    const day = schedule[dateKey];
    if (!day || typeof day !== 'object') return true;
    return Object.values(day).every((slot) => !Array.isArray(slot) || slot.length === 0);
  });
}

// 네트워크 실패 시뮬레이션 플래그
let networkDown = false;

async function loadScheduleFromDB(yearMonth) {
  if (networkDown) return { ok: false, error: 'network timeout' };
  if (!db.has(yearMonth)) return { ok: true, data: null };
  return { ok: true, data: db.get(yearMonth) };
}

async function saveScheduleToDB(schedule, yearMonth) {
  if (networkDown) return { ok: false, error: 'network timeout' };
  db.set(yearMonth, schedule);
  return { ok: true };
}

async function loadSchedule(yearMonth) {
  const res = await loadScheduleFromDB(yearMonth);
  if (!res.ok) {
    const localData = local.get(yearMonth);
    return { ok: false, error: res.error, data: localData ? JSON.parse(localData) : {} };
  }
  if (res.data) return { ok: true, data: res.data };
  const localData = local.get(yearMonth);
  return { ok: true, data: localData ? JSON.parse(localData) : {} };
}

async function saveSchedule(schedule, yearMonth) {
  // 빈 스케줄 방어
  if (isEmptySchedule(schedule)) {
    const existing = db.get(yearMonth);
    if (existing && !isEmptySchedule(existing)) {
      return { ok: false, error: '빈 스케줄로 기존 데이터를 덮어쓰는 것을 방지했습니다.' };
    }
  }
  local.set(yearMonth, JSON.stringify(schedule));
  return await saveScheduleToDB(schedule, yearMonth);
}

// useSchedule hook 의 핵심 동작 재현 (동기/비동기 타이밍만 시뮬) ------------

function createHook() {
  let schedule = {};
  let yearMonth = null;
  let loading = true;
  const saveTimer = { id: null };
  const pendingRef = { current: null };
  const loadedYearMonthRef = { current: null };
  const loadFailedRef = { current: false };
  const firstSkipRef = { current: true };

  async function loadMonth(newYearMonth) {
    // 이전 pending flush (취소가 아닌 flush)
    if (saveTimer.id) {
      clearTimeout(saveTimer.id);
      saveTimer.id = null;
    }
    const pending = pendingRef.current;
    if (pending && !loadFailedRef.current) {
      await saveSchedule(pending.schedule, pending.yearMonth);
    }
    pendingRef.current = null;

    loading = true;
    yearMonth = newYearMonth;

    const res = await loadSchedule(newYearMonth);
    loadFailedRef.current = !res.ok;
    firstSkipRef.current = true;
    schedule = res.data || {};
    loadedYearMonthRef.current = newYearMonth;
    loading = false;
    // React에서는 load 완료 후 setSchedule/setLoading이 re-render를 일으켜
    // save useEffect가 자동 발동됨 → firstSkip 소비. 이를 수동 호출로 흉내.
    runSaveEffect();
  }

  function edit(dateStr, slotKey, empId) {
    if (loading) return;
    if (loadedYearMonthRef.current !== yearMonth) return;
    const day = schedule[dateStr] || {};
    const slot = day[slotKey] || [];
    if (!slot.includes(empId)) {
      schedule = { ...schedule, [dateStr]: { ...day, [slotKey]: [...slot, empId] } };
    }
    runSaveEffect(); // React 재렌더 → save effect 실행을 흉내
  }

  // React의 save useEffect 를 수동으로 호출하는 헬퍼.
  // - 로드 후: 이 함수를 별도 호출하여 firstSkip 소비 시뮬
  // - 편집 후: edit() 에서 자동 호출
  function runSaveEffect() {
    if (loading) return;
    if (loadedYearMonthRef.current !== yearMonth) return;
    if (firstSkipRef.current) {
      firstSkipRef.current = false;
      return;
    }
    pendingRef.current = { schedule, yearMonth };
    if (saveTimer.id) clearTimeout(saveTimer.id);
    saveTimer.id = setTimeout(async () => {
      const p = pendingRef.current;
      if (!p) return;
      if (loadFailedRef.current) return;
      if (loadedYearMonthRef.current !== p.yearMonth) return;
      await saveSchedule(p.schedule, p.yearMonth);
      pendingRef.current = null;
    }, 50);
  }

  async function flush() {
    if (saveTimer.id) {
      clearTimeout(saveTimer.id);
      saveTimer.id = null;
    }
    const p = pendingRef.current;
    if (!p) return;
    if (loadFailedRef.current) return;
    await saveSchedule(p.schedule, p.yearMonth);
    pendingRef.current = null;
  }

  function getSchedule() { return schedule; }
  function getLoading() { return loading; }

  return { loadMonth, edit, flush, getSchedule, getLoading };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ===== 테스트 케이스 =====

async function test_monthSwitchRace() {
  resetAll();
  networkDown = false;

  // 사전: 2월에 데이터 존재
  db.set('2026-02', { '2026-02-10': { '9': ['emp1'] } });

  const hook = createHook();
  await hook.loadMonth('2026-01');

  // 1월에서 편집 (실제 시나리오: 작성 중)
  hook.edit('2026-01-05', '8', 'empA');
  // 저장 debounce 내에 2월로 이동
  await hook.loadMonth('2026-02');

  await wait(100); // debounce 넘기기

  // 2월 데이터가 1월 데이터로 덮어씌워졌는지 확인
  const feb = db.get('2026-02');
  assert.deepEqual(feb, { '2026-02-10': { '9': ['emp1'] } }, '❌ 2월 데이터가 1월 데이터로 덮어씌워짐');

  // 1월 데이터도 정상 저장됐는지 확인
  const jan = db.get('2026-01');
  assert.deepEqual(jan, { '2026-01-05': { '8': ['empA'] } }, '❌ 1월 편집이 저장되지 않음');

  console.log('✅ Test 1: 월 전환 Race 방지 + 이전 월 flush OK');
}

async function test_loadFailure() {
  resetAll();
  // DB에 기존 데이터 존재
  db.set('2026-03', { '2026-03-15': { '10': ['empX'] } });

  const hook = createHook();
  networkDown = true; // 로드 시점에 네트워크 다운
  await hook.loadMonth('2026-03');

  // 사용자가 편집을 시도하지만 loadFailed 상태라 저장 차단되어야 함
  hook.edit('2026-03-20', '14', 'empY');
  await wait(100);

  // 네트워크 복구 후에도, pending 저장이 실행되면 안 됨
  networkDown = false;
  await wait(100);

  const mar = db.get('2026-03');
  assert.deepEqual(mar, { '2026-03-15': { '10': ['empX'] } }, '❌ 로드 실패 상태에서 저장되어 DB 오염됨');

  console.log('✅ Test 2: 로드 실패 시 저장 차단 OK');
}

async function test_rapidMonthSwitch() {
  resetAll();
  networkDown = false;
  db.set('2026-01', { '2026-01-05': { '8': ['empA'] } });
  db.set('2026-02', { '2026-02-10': { '9': ['emp1'] } });
  db.set('2026-03', { '2026-03-15': { '10': ['empX'] } });

  const hook = createHook();
  await hook.loadMonth('2026-01');

  // 편집 후 빠르게 2월 → 3월 이동
  hook.edit('2026-01-06', '8', 'empB');
  const p1 = hook.loadMonth('2026-02');
  const p2 = hook.loadMonth('2026-03');
  await Promise.all([p1, p2]);
  await wait(100);

  // 각 월 데이터 보존 확인
  assert.equal(db.get('2026-02')['2026-02-10']?.[9]?.[0], 'emp1', '❌ 2월 데이터 오염');
  assert.equal(db.get('2026-03')['2026-03-15']?.[10]?.[0], 'empX', '❌ 3월 데이터 오염');
  // 1월 편집은 flush 되었거나 아직 저장 전이거나 — 최소한 기존 데이터가 덮어써지면 안 됨
  const jan = db.get('2026-01');
  assert.ok(jan['2026-01-05']?.[8]?.includes('empA'), '❌ 1월 기존 데이터 손실');

  console.log('✅ Test 3: 빠른 월 전환 중 각 월 데이터 보존 OK');
}

async function test_emptyScheduleGuard() {
  resetAll();
  networkDown = false;
  db.set('2026-04', { '2026-04-10': { '11': ['empZ'] } });

  // 빈 스케줄 직접 저장 시도
  const result = await saveSchedule({}, '2026-04');
  assert.equal(result.ok, false, '❌ 빈 스케줄 방어층이 작동하지 않음');
  assert.match(result.error, /덮어쓰는 것을 방지/);

  // DB는 보존됨
  assert.deepEqual(db.get('2026-04'), { '2026-04-10': { '11': ['empZ'] } });

  console.log('✅ Test 4: 빈 스케줄 덮어쓰기 방어 OK');
}

async function test_pendingFlushKeyIntegrity() {
  resetAll();
  networkDown = false;

  const hook = createHook();
  await hook.loadMonth('2026-05');

  // 연속 편집
  hook.edit('2026-05-01', '8', 'e1');
  hook.edit('2026-05-02', '9', 'e2');

  // 월 이동 (pending flush 발생해야 함)
  await hook.loadMonth('2026-06');
  await wait(100);

  const may = db.get('2026-05');
  assert.ok(may['2026-05-01']?.[8]?.includes('e1'), '❌ 5월 편집 유실');
  assert.ok(may['2026-05-02']?.[9]?.includes('e2'), '❌ 5월 편집 유실');

  // 6월에는 5월 데이터가 누출되지 않아야 함
  const jun = db.get('2026-06');
  if (jun) {
    assert.equal(jun['2026-05-01'], undefined, '❌ 5월 키가 6월에 누출');
  }

  console.log('✅ Test 5: pending flush 키 무결성 OK');
}

async function test_reloadSameMonth() {
  resetAll();
  networkDown = false;

  const hook = createHook();
  await hook.loadMonth('2026-07');
  hook.edit('2026-07-10', '12', 'empQ');
  await wait(100);

  // 같은 월로 재로드 (새로고침 시나리오)
  await hook.loadMonth('2026-07');
  const scheduleAfter = hook.getSchedule();
  assert.ok(scheduleAfter['2026-07-10']?.[12]?.includes('empQ'), '❌ 새로고침 후 데이터 유실');

  console.log('✅ Test 6: 동일 월 재로드 (새로고침) 데이터 유지 OK');
}

async function test_editDuringLoading() {
  resetAll();
  networkDown = false;
  db.set('2026-08', { '2026-08-01': { '8': ['existing'] } });

  const hook = createHook();
  const loadPromise = hook.loadMonth('2026-08'); // 아직 완료 안 됨
  // 로딩 중에 편집 시도 (loading=true 상태) → 무시되어야 함
  hook.edit('2026-08-02', '9', 'ghost');
  await loadPromise;

  const sched = hook.getSchedule();
  assert.equal(sched['2026-08-02'], undefined, '❌ 로딩 중 편집이 반영됨');
  assert.ok(sched['2026-08-01']?.[8]?.includes('existing'), '❌ 기존 데이터 손실');

  await wait(100);
  // DB도 오염되지 않아야 함
  const aug = db.get('2026-08');
  assert.deepEqual(aug, { '2026-08-01': { '8': ['existing'] } }, '❌ 로딩 중 편집이 DB에 저장됨');

  console.log('✅ Test 7: 로딩 중 편집 무시 OK');
}

async function test_networkDownDuringEdit() {
  resetAll();
  networkDown = false;
  db.set('2026-09', { '2026-09-01': { '8': ['orig'] } });

  const hook = createHook();
  await hook.loadMonth('2026-09');
  hook.edit('2026-09-02', '9', 'new1');

  // 편집 직후 네트워크 다운
  networkDown = true;
  await wait(100);

  // DB 저장은 실패했지만 localStorage는 보존됨
  assert.ok(local.has('2026-09'), '❌ localStorage 백업 없음');

  // 네트워크 복구
  networkDown = false;
  hook.edit('2026-09-03', '10', 'new2');
  await wait(100);

  // 최종적으로 DB에 두 편집 모두 반영돼야 함
  const sep = db.get('2026-09');
  assert.ok(sep['2026-09-02']?.[9]?.includes('new1'), '❌ 네트워크 복구 후 저장 누락');
  assert.ok(sep['2026-09-03']?.[10]?.includes('new2'), '❌ 네트워크 복구 후 저장 누락');

  console.log('✅ Test 8: 네트워크 다운-복구 시 데이터 보존 OK');
}

async function test_loadFailsInitiallyThenRecovers() {
  resetAll();
  db.set('2026-10', { '2026-10-01': { '8': ['kept'] } });

  const hook = createHook();
  networkDown = true;
  await hook.loadMonth('2026-10'); // 실패 → loadFailed=true

  // 이 상태에서 편집이 저장으로 이어지면 안 됨
  hook.edit('2026-10-02', '9', 'bad');
  await wait(100);
  // DB 원본 유지
  assert.deepEqual(db.get('2026-10'), { '2026-10-01': { '8': ['kept'] } }, '❌ 로드실패 후 편집이 DB 오염');

  // 다른 월로 이동 후 원래 월로 재로드 → 복구
  networkDown = false;
  await hook.loadMonth('2026-11');
  await hook.loadMonth('2026-10');
  hook.edit('2026-10-03', '10', 'good');
  await wait(100);

  const oct = db.get('2026-10');
  assert.ok(oct['2026-10-01']?.[8]?.includes('kept'), '❌ 원본 데이터 손실');
  assert.ok(oct['2026-10-03']?.[10]?.includes('good'), '❌ 복구 후 편집 저장 실패');

  console.log('✅ Test 9: 로드 실패 → 복구 시나리오 OK');
}

async function test_switchBackRestoresData() {
  resetAll();
  networkDown = false;

  const hook = createHook();
  await hook.loadMonth('2026-11');
  hook.edit('2026-11-10', '14', 'alice');
  await wait(100);

  await hook.loadMonth('2026-12');
  hook.edit('2026-12-05', '9', 'bob');
  await wait(100);

  // 11월로 돌아갔을 때 alice 편집이 살아있어야 함
  await hook.loadMonth('2026-11');
  const nov = hook.getSchedule();
  assert.ok(nov['2026-11-10']?.[14]?.includes('alice'), '❌ 이전 월로 돌아갔을 때 데이터 유실');

  console.log('✅ Test 10: 월 간 이동 후 돌아왔을 때 데이터 유지 OK (초기화 방지)');
}

// ===== 실행 =====

(async () => {
  try {
    await test_monthSwitchRace();
    await test_loadFailure();
    await test_rapidMonthSwitch();
    await test_emptyScheduleGuard();
    await test_pendingFlushKeyIntegrity();
    await test_reloadSameMonth();
    await test_editDuringLoading();
    await test_networkDownDuringEdit();
    await test_loadFailsInitiallyThenRecovers();
    await test_switchBackRestoresData();
    console.log('\n🎉 전체 10개 테스트 통과');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ 테스트 실패:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
