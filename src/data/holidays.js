// 헤센주(프랑크푸르트) 공휴일
// 매년 업데이트 필요 (부활절 등 이동 공휴일)

export const HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'Neujahrstag', nameKo: '새해' },
  { date: '2026-04-03', name: 'Karfreitag', nameKo: '성금요일' },
  { date: '2026-04-06', name: 'Ostermontag', nameKo: '부활절 월요일' },
  { date: '2026-05-01', name: 'Tag der Arbeit', nameKo: '노동절' },
  { date: '2026-05-14', name: 'Christi Himmelfahrt', nameKo: '예수승천일' },
  { date: '2026-05-25', name: 'Pfingstmontag', nameKo: '성령강림절 월요일' },
  { date: '2026-06-04', name: 'Fronleichnam', nameKo: '성체축일' },
  { date: '2026-10-03', name: 'Tag der Deutschen Einheit', nameKo: '독일통일기념일' },
  { date: '2026-12-25', name: '1. Weihnachtstag', nameKo: '크리스마스' },
  { date: '2026-12-26', name: '2. Weihnachtstag', nameKo: '크리스마스 다음날' },
];

export function isHoliday(dateStr) {
  return HOLIDAYS_2026.find(h => h.date === dateStr) || null;
}

export function isSunday(dateStr) {
  return new Date(dateStr).getDay() === 0;
}

export function isStoreClosedDay(dateStr) {
  return isSunday(dateStr) || isHoliday(dateStr) !== null;
}
