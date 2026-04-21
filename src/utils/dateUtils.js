// 바이브서울 스케줄 날짜 유틸 — Europe/Berlin 기준 일관 처리
// 모든 스케줄 날짜 문자열은 "YYYY-MM-DD" (독일 현지 기준 영업일)

export const STORE_TIMEZONE = 'Europe/Berlin';

// "YYYY-MM-DD" 문자열을 로컬 자정 Date로 파싱
// (new Date(str)는 UTC로 파싱되어 브라우저 타임존에 따라 날짜가 밀리므로 사용 금지)
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date → "YYYY-MM-DD" (로컬 기준)
export function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 날짜 조립: 연/월(0-indexed)/일 → "YYYY-MM-DD"
export function buildDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "YYYY-MM-DD"의 요일 (0=일 ~ 6=토). 타임존 무관 (달력상 요일).
export function getDayOfWeek(dateStr) {
  return parseDateStr(dateStr).getDay();
}

// 해당 "YYYY-MM-DD"가 유럽/베를린에서 DST 적용 중인지 (CEST=true, CET=false).
// 영업시간(08~20시)에는 DST 전환이 영향을 주지 않지만, 이벤트 시간 표기/검증에 참고.
export function isBerlinDST(dateStr) {
  const d = parseDateStr(dateStr);
  // 1월 기준 오프셋 vs 해당일 오프셋 비교로 DST 여부 판정 (브라우저 TZ와 무관하게 베를린만)
  const janOffset = berlinOffsetMinutes(new Date(d.getFullYear(), 0, 15));
  const dayOffset = berlinOffsetMinutes(d);
  return dayOffset !== janOffset;
}

// Europe/Berlin UTC 오프셋(분) — DST 반영
function berlinOffsetMinutes(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIMEZONE,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(date);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  // "GMT+1" / "GMT+02:00" 등
  const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tzName);
  if (!match) return 60;
  const sign = match[1] === '-' ? -1 : 1;
  const hh = Number(match[2]);
  const mm = Number(match[3] || 0);
  return sign * (hh * 60 + mm);
}
