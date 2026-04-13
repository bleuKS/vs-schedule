import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase가 설정되지 않은 경우 null (localStorage fallback)
export const supabase =
  supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export const isSupabaseConfigured = () => supabase !== null;

// === 스케줄 CRUD ===

export async function saveScheduleToDB(schedule, yearMonth, updatedBy = 'admin') {
  if (!supabase) return false;
  const { error } = await supabase
    .from('schedules')
    .upsert(
      { year_month: yearMonth, data: schedule, updated_at: new Date().toISOString(), updated_by: updatedBy },
      { onConflict: 'year_month' }
    );
  if (error) {
    console.error('스케줄 저장 실패:', error);
    return false;
  }
  return true;
}

export async function loadScheduleFromDB(yearMonth) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('schedules')
    .select('data')
    .eq('year_month', yearMonth)
    .single();
  if (error) {
    if (error.code !== 'PGRST116') console.error('스케줄 로딩 실패:', error);
    return null;
  }
  return data?.data || null;
}

// === 직원 CRUD ===

export async function saveEmployeesToDB(employees) {
  if (!supabase) return false;
  // 단일 레코드로 저장 (id=1 고정)
  const { error } = await supabase
    .from('employees')
    .upsert(
      { id: '00000000-0000-0000-0000-000000000001', data: employees, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) {
    console.error('직원 저장 실패:', error);
    return false;
  }
  return true;
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

export async function saveShiftTypesToDB(shiftTypes) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('shift_types')
    .upsert(
      { id: '00000000-0000-0000-0000-000000000001', data: shiftTypes, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) {
    console.error('시프트 저장 실패:', error);
    return false;
  }
  return true;
}

export async function loadShiftTypesFromDB() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('shift_types')
    .select('data')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single();
  if (error) {
    if (error.code !== 'PGRST116') console.error('시프트 로딩 실패:', error);
    return null;
  }
  return data?.data || null;
}
