// 휴게시간 자동 계산 (독일 Arbeitszeitgesetz §4)
export function calculateBreakMinutes(totalHours) {
  if (totalHours > 9) return 45;
  if (totalHours > 6) return 30;
  return 0;
}

// 실 근무시간 계산
export function calculateNetHours(startHour, endHour, breakMinutes) {
  const totalHours = endHour - startHour;
  return totalHours - breakMinutes / 60;
}

export const DEFAULT_SHIFT_TYPES = [
  {
    id: 'opening-full',
    name: '오프닝 풀타임',
    start: 8,
    end: 17,
    breakMinutes: 60,
    netHours: 8,
    color: '#e91e9e',
  },
  {
    id: 'long-shift',
    name: '롱 시프트',
    start: 9,
    end: 19,
    breakMinutes: 45,
    netHours: 9.25,
    color: '#e91e9e',
  },
  {
    id: 'mid-shift',
    name: '미드 시프트',
    start: 11,
    end: 19,
    breakMinutes: 30,
    netHours: 7.5,
    color: '#2196f3',
  },
  {
    id: 'afternoon-part',
    name: '오후 파트',
    start: 14,
    end: 19,
    breakMinutes: 0,
    netHours: 5,
    color: '#4caf50',
  },
  {
    id: 'evening-part',
    name: '저녁 파트',
    start: 17,
    end: 20,
    breakMinutes: 0,
    netHours: 3,
    color: '#ff9800',
  },
  {
    id: 'morning-mini',
    name: '미니잡 오전',
    start: 9,
    end: 13,
    breakMinutes: 0,
    netHours: 4,
    color: '#ff9800',
  },
  {
    id: 'minor-shift',
    name: '미성년자 시프트',
    start: 18,
    end: 20,
    breakMinutes: 0,
    netHours: 2,
    color: '#9c27b0',
  },
];
