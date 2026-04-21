// 고용 유형 정의
export const EMPLOYMENT_TYPES = {
  VOLLZEIT: {
    id: 'vollzeit',
    label: '정규직 (Vollzeit)',
    color: '#e91e9e',       // 마젠타
    maxDailyHours: 10,
    recommendedDailyHours: 8,
    maxWeeklyHours: 48,
    recommendedWeeklyHours: 40,
    maxMonthlyHours: null,
  },
  TEILZEIT: {
    id: 'teilzeit',
    label: '파트타임 (Teilzeit)',
    color: '#2196f3',       // 파란색
    maxDailyHours: 10,
    recommendedDailyHours: 8,
    maxWeeklyHours: 48,
    recommendedWeeklyHours: null, // 계약에 따라 다름
    maxMonthlyHours: null,
  },
  WERKSTUDENT: {
    id: 'werkstudent',
    label: '학생 (Werkstudent)',
    color: '#4caf50',       // 초록색
    maxDailyHours: 10,
    recommendedDailyHours: 8,
    maxWeeklyHours: 20,
    recommendedWeeklyHours: 20,
    maxMonthlyHours: null,
  },
  MINIJOB: {
    id: 'minijob',
    label: '미니잡 (Minijob)',
    color: '#ff9800',       // 주황색
    maxDailyHours: 10,
    recommendedDailyHours: 8,
    maxWeeklyHours: null,
    recommendedWeeklyHours: null,
    maxMonthlyHours: 47,    // 603유로 / ~12.82유로 시급
  },
  MINDERJAEHRIG: {
    id: 'minderjaehrig',
    label: '미성년자 (Minderjährig)',
    color: '#9c27b0',       // 보라색
    maxDailyHours: 2,       // 주중 최대 2시간
    recommendedDailyHours: 2,
    maxWeeklyHours: 10,
    recommendedWeeklyHours: null,
    maxMonthlyHours: null,
  },
  FREELANCER: {
    id: 'freelancer',
    label: '프리랜서 (Freelancer)',
    color: '#00bcd4',       // 청록색
    maxDailyHours: 10,      // 독일 ArbZG 일반 제한 참고값
    recommendedDailyHours: 8,
    maxWeeklyHours: null,   // 계약 기반, 제한 없음
    recommendedWeeklyHours: null,
    maxMonthlyHours: null,
  },
};

// 직원 마스터 데이터
export const DEFAULT_EMPLOYEES = [
  // === 정규직 ===
  {
    id: 'leekwan',
    name: 'LeeKwan',
    displayName: '이관',
    type: 'vollzeit',
    dayOff: null,         // 정기 휴무일 없음 (주 5일 근무)
    isMinor: false,
    contractHours: 40,
    notes: '매니저 / 오프닝 담당 (8:00 출근)',
  },
  {
    id: 'ella',
    name: 'Ella(이선혜)',
    displayName: '이선혜 (Ella)',
    type: 'vollzeit',
    dayOff: 1,            // 월요일 (0=일, 1=월, ..., 6=토)
    isMinor: false,
    contractHours: 40,
    notes: '정규직 / 월요일 정기 휴무',
  },
  {
    id: 'jina',
    name: 'Jina(윤혜진)',
    displayName: '윤혜진 (Jina)',
    type: 'vollzeit',
    dayOff: 4,            // 목요일
    isMinor: false,
    contractHours: 40,
    notes: '정규직 / 목요일 정기 휴무',
  },

  // === 파트타임 ===
  {
    id: 'anna',
    name: 'Anna',
    displayName: 'Anna',
    type: 'teilzeit',
    dayOff: null,
    isMinor: false,
    contractHours: 20,
    notes: '파트타임',
  },
  {
    id: 'tommy',
    name: 'Tommy',
    displayName: 'Tommy',
    type: 'teilzeit',
    dayOff: null,
    isMinor: false,
    contractHours: 20,
    notes: '파트타임',
  },
  {
    id: 'damla',
    name: 'Damla',
    displayName: 'Damla',
    type: 'teilzeit',
    dayOff: null,
    isMinor: false,
    contractHours: 20,
    notes: '파트타임',
  },
  {
    id: 'mo',
    name: 'Mo',
    displayName: 'Mo',
    type: 'teilzeit',
    dayOff: null,
    isMinor: false,
    contractHours: 15,
    notes: '파트타임',
  },

  // === 학생 (Werkstudent) - 주 20시간 제한 ===
  {
    id: 'seongbin',
    name: 'Seongbin',
    displayName: '성빈 (Seongbin)',
    type: 'werkstudent',
    dayOff: null,
    isMinor: false,
    contractHours: 20,
    notes: '학생 / 주 20시간 제한',
  },
  {
    id: 'hyeonji',
    name: 'Hyeonji',
    displayName: '현지 (Hyeonji)',
    type: 'werkstudent',
    dayOff: null,
    isMinor: false,
    contractHours: 20,
    notes: '학생 / 주 20시간 제한',
  },

  // === 미니잡 ===
  {
    id: 'cihan',
    name: 'Cihan',
    displayName: 'Cihan',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '미니잡',
  },
  {
    id: 'eden',
    name: 'Eden',
    displayName: 'Eden',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '미니잡',
  },
  {
    id: 'dayju',
    name: 'Dayju',
    displayName: 'Dayju',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '미니잡',
  },
  {
    id: 'hanmin',
    name: 'Hanmin',
    displayName: '한민 (Hanmin)',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '미니잡',
  },
  {
    id: 'chaeyoung',
    name: 'Chaeyoung',
    displayName: '채영 (Chaeyoung)',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '미니잡',
  },

  // === 미성년자 (매장·카페 겸직) ===
  {
    id: 'unoo',
    name: 'Unoo',
    displayName: '유누 (Unoo)',
    type: 'minderjaehrig',
    dayOff: null,
    isMinor: true,
    contractHours: null,
    notes: '미성년자 / 주중 최대 2시간',
    locations: ['store', 'cafe'],
  },
  {
    id: 'nayeon',
    name: 'Nayeon',
    displayName: '나연 (Nayeon)',
    type: 'minderjaehrig',
    dayOff: null,
    isMinor: true,
    contractHours: null,
    notes: '미성년자 / 주중 최대 2시간',
    locations: ['store', 'cafe'],
  },

  // === 카페 일반 직원 ===
  {
    id: 'hyunah',
    name: '현아',
    displayName: '현아 (Hyunah)',
    type: 'freelancer',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '카페 프리랜서',
    locations: ['cafe'],
  },
  {
    id: 'youngjun',
    name: '영준',
    displayName: '영준 (Youngjun)',
    type: 'minijob',
    dayOff: null,
    isMinor: false,
    contractHours: null,
    notes: '카페 직원',
    locations: ['cafe'],
  },
];
