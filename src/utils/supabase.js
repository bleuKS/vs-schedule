import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export const isSupabaseConfigured = () => supabase !== null;

const describeError = (error) => {
  if (!error) return '알 수 없는 오류';
  const code = error.code ? ` (${error.code})` : '';
  const detail = error.message || '요청 실패';
  return `${detail}${code}`;
};

// === 스케줄 CRUD ===

export async function saveScheduleToDB(schedule, yearMonth, updatedBy = 'admin') {
  if (!supabase) return { ok: false, error: 'Supabase 미설정' };
  try {
    const { error } = await supabase
      .from('schedules')
      .upsert(
        { year_month: yearMonth, data: schedule, updated_at: new Date().toISOString(), updated_by: updatedBy },
        { onConflict: 'year_month' }
      );
    if (error) {
      console.error('스케줄 저장 실패:', error);
      return { ok: false, error: describeError(error) };
    }
    return { ok: true };
  } catch (err) {
    console.error('스케줄 저장 예외:', err);
    return { ok: false, error: err.message || '네트워크 오류' };
  }
}

// 반환 형태: { ok: true, data: object|null } 성공 (null = 레코드 없음)
//            { ok: false, error: string }   실제 로드 실패 (네트워크/권한 등)
export async function loadScheduleFromDB(yearMonth) {
  if (!supabase) return { ok: true, data: null };
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('data')
      .eq('year_month', yearMonth)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        // Row not found — 정상적인 "빈 월"
        return { ok: true, data: null };
      }
      console.error('스케줄 로딩 실패:', error);
      return { ok: false, error: describeError(error) };
    }
    return { ok: true, data: data?.data || null };
  } catch (err) {
    console.error('스케줄 로딩 예외:', err);
    return { ok: false, error: err.message || '네트워크 오류' };
  }
}

// === 시프트 타입 레코드 ID (scope별) ===
const SHIFT_TYPE_IDS = {
  store: '00000000-0000-0000-0000-000000000001',
  cafe: '00000000-0000-0000-0000-000000000002',
};

// === 직원 CRUD ===

export async function saveEmployeesToDB(employees) {
  if (!supabase) return { ok: false, error: 'Supabase 미설정' };
  try {
    const { error } = await supabase
      .from('employees')
      .upsert(
        { id: '00000000-0000-0000-0000-000000000001', data: employees, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) {
      console.error('직원 저장 실패:', error);
      return { ok: false, error: describeError(error) };
    }
    return { ok: true };
  } catch (err) {
    console.error('직원 저장 예외:', err);
    return { ok: false, error: err.message || '네트워크 오류' };
  }
}

export async function loadEmployeesFromDB() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('employees')
    .select('data')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single();
  if (error) {
    if (error.code !== 'PGRST116') console.error('직원 로딩 실패:', error);
    return null;
  }
  return data?.data || null;
}

// === 시프트 타입 CRUD ===

export async function saveShiftTypesToDB(shiftTypes, scope = 'store') {
  if (!supabase) return { ok: false, error: 'Supabase 미설정' };
  const recordId = SHIFT_TYPE_IDS[scope] || SHIFT_TYPE_IDS.store;
  try {
    const { error } = await supabase
      .from('shift_types')
      .upsert(
        { id: recordId, data: shiftTypes, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) {
      console.error(`시프트 저장 실패 (${scope}):`, error);
      return { ok: false, error: describeError(error) };
    }
    return { ok: true };
  } catch (err) {
    console.error(`시프트 저장 예외 (${scope}):`, err);
    return { ok: false, error: err.message || '네트워크 오류' };
  }
}

export async function loadShiftTypesFromDB(scope = 'store') {
  if (!supabase) return null;
  const recordId = SHIFT_TYPE_IDS[scope] || SHIFT_TYPE_IDS.store;
  const { data, error } = await supabase
    .from('shift_types')
    .select('data')
    .eq('id', recordId)
    .single();
  if (error) {
    if (error.code !== 'PGRST116') console.error(`시프트 로딩 실패 (${scope}):`, error);
    return null;
  }
  return data?.data || null;
}
