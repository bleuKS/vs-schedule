// 휴게시간 자동 계산 (독일 Arbeitszeitgesetz §4)
export function calculateBreakMinutes(totalHours) {
  if (totalHours > 9) return 45;
  if (totalHours > 6) return 30;
  return 0;
}

export function calculateNetHours(startHour, endHour, breakMinutes) {
  const totalHours = endHour - startHour;
  return totalHours - breakMinutes / 60;
}

// 슬롯 키 ↔ 분 변환 유틸
// 슬롯 키 형식:
//   "8", "14" 같은 정수 문자열 → 60분 슬롯 (해당 시간 정각~다음 정각)
//   "10:30", "14:00" 같은 HH:MM 문자열 → 30분 슬롯 (해당 시각~+30분)
export function parseSlotKey(key) {
  const s = String(key);
  if (s.includes(':')) {
    const [h, m] = s.split(':').map(Number);
    return { hour: h, minute: m, totalMin: h * 60 + m };
  }
  const h = Number(s);
  return { hour: h, minute: 0, totalMin: h * 60 };
}

// 슬롯이 차지하는 시간(시간 단위) — "HH:MM"이면 0.5, 숫자면 1
export function slotDurationHours(key) {
  return String(key).includes(':') ? 0.5 : 1;
}

export function slotDurationMinutes(key) {
  return String(key).includes(':') ? 30 : 60;
}

// 슬롯 라벨 포맷 ("08:00", "14:30")
export function slotLabel(key) {
  const { hour, minute } = parseSlotKey(key);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// 시프트가 차지하는 슬롯 키 배열 반환 (모두 문자열)
// slots가 명시되면 그대로, 없으면 start~end-1 범위로 정수 시간 슬롯 생성
export function getShiftSlots(shift) {
  if (Array.isArray(shift.slots) && shift.slots.length) {
    return shift.slots.map(s => String(s));
  }
  const out = [];
  for (let h = shift.start; h < shift.end; h++) out.push(String(h));
  return out;
}

// 시프트 시간 표시 라벨 (예: "10:30~14:30")
export function formatShiftLabel(shift) {
  const startMin = shift.startMinute ?? 0;
  const endMin = shift.endMinute ?? 0;
  const s = `${String(shift.start).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const e = `${String(shift.end).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  return `${s}~${e}`;
}

// 카페 그리드용 30분 슬롯 (10:30 ~ 19:30, 총 18슬롯)
// 마지막 슬롯 "19:00"은 19:00~19:30을 표현
export const CAFE_SLOT_KEYS = [
  '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00',
];

// 매장 그리드용 60분 슬롯 (8 ~ 20, 총 12슬롯)
export const STORE_SLOT_KEYS = Array.from({ length: 12 }, (_, i) => String(i + 8));

// === 매장(0층/1층) 시프트 타입 ===
export const DEFAULT_STORE_SHIFT_TYPES = [
  {
    id: 'store-open-support-full',
    name: '오픈지원풀타임',
    start: 8,
    end: 17,
    breakMinutes: 60,
    netHours: 8,
    color: '#c2185b',
  },
  {
    id: 'store-open-full',
    name: '오픈풀타임',
    start: 9,
    end: 18,
    breakMinutes: 60,
    netHours: 8,
    color: '#e91e63',
  },
  {
    id: 'store-closing-full',
    name: '클로징풀타임',
    start: 11,
    end: 20,
    breakMinutes: 60,
    netHours: 8,
    color: '#7b1fa2',
  },
  {
    id: 'store-open-part',
    name: '오픈쉬프트(알바)',
    start: 10,
    end: 16,
    breakMinutes: 30,
    netHours: 5.5,
    color: '#2196f3',
  },
  {
    id: 'store-mid-part',
    name: '미드쉬프트(알바)',
    start: 12,
    end: 18,
    breakMinutes: 30,
    netHours: 5.5,
    color: '#009688',
  },
  {
    id: 'store-close-part',
    name: '마감쉬프트(알바)',
    start: 17,
    end: 20,
    breakMinutes: 0,
    netHours: 3,
    color: '#ff9800',
  },
];

// === 카페 시프트 타입 (30분 정확도) ===
// 카페 영업시간: 10:30 ~ 19:30
export const DEFAULT_CAFE_SHIFT_TYPES = [
  {
    id: 'cafe-opening',
    name: '카페 오픈',
    start: 10,
    startMinute: 30,
    end: 14,
    endMinute: 30,
    slots: ['10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'],
    breakMinutes: 0,
    netHours: 4,
    color: '#0288d1',
  },
  {
    id: 'cafe-middle',
    name: '카페 미들',
    start: 12,
    end: 18,
    slots: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
    breakMinutes: 30,
    netHours: 5.5,
    color: '#00acc1',
  },
  {
    id: 'cafe-closing',
    name: '카페 마감',
    start: 14,
    startMinute: 30,
    end: 19,
    endMinute: 30,
    slots: ['14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
    breakMinutes: 0,
    netHours: 5,
    color: '#7b1fa2',
  },
  {
    id: 'cafe-full',
    name: '카페 풀타임',
    start: 10,
    startMinute: 30,
    end: 19,
    endMinute: 30,
    slots: [...CAFE_SLOT_KEYS],
    breakMinutes: 60,
    netHours: 8,
    color: '#5e35b1',
  },
];

// 기존 호환용
export const DEFAULT_SHIFT_TYPES = DEFAULT_STORE_SHIFT_TYPES;
