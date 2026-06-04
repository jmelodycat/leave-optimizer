// 공휴일 데이터 (data.go.kr 한국천문연구원_특일정보 API 기준)
// API 키 발급 전 fallback 데이터 (음력 기반 공휴일은 API 연동 시 정확히 반영)

export const HOLIDAY_DATA = {
  2026: [
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '삼일절 대체공휴일' },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일' },
    { date: '2026-06-06', name: '현충일' },
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-08-17', name: '광복절 대체공휴일' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '개천절 대체공휴일' },
    { date: '2026-10-09', name: '한글날' },
    { date: '2026-12-25', name: '성탄절' },
  ],
  2027: [
    { date: '2027-01-01', name: '신정' },
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-02-09', name: '설날 대체공휴일' },
    { date: '2027-03-01', name: '삼일절' },
    { date: '2027-05-05', name: '어린이날' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-06-06', name: '현충일' },
    { date: '2027-08-15', name: '광복절' },
    { date: '2027-08-16', name: '광복절 대체공휴일' },
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
    { date: '2027-10-03', name: '개천절' },
    { date: '2027-10-04', name: '개천절 대체공휴일' },
    { date: '2027-10-09', name: '한글날' },
    { date: '2027-12-25', name: '성탄절' },
  ],
  2028: [
    { date: '2028-01-01', name: '신정' },
    { date: '2028-01-25', name: '설날 연휴' },
    { date: '2028-01-26', name: '설날' },
    { date: '2028-01-27', name: '설날 연휴' },
    { date: '2028-03-01', name: '삼일절' },
    { date: '2028-05-05', name: '어린이날' },
    { date: '2028-05-02', name: '부처님오신날' },
    { date: '2028-06-06', name: '현충일' },
    { date: '2028-08-15', name: '광복절' },
    { date: '2028-10-03', name: '개천절' },
    { date: '2028-10-09', name: '한글날' },
    { date: '2028-10-16', name: '추석 연휴' },
    { date: '2028-10-17', name: '추석' },
    { date: '2028-10-18', name: '추석 연휴' },
    { date: '2028-12-25', name: '성탄절' },
  ],
}

// API에서 공휴일 가져오기 (Vercel 배포 후 사용)
export async function fetchHolidays(year) {
  try {
    const res = await fetch(`/api/holidays?year=${year}`)
    if (!res.ok) throw new Error('API 응답 오류')
    const data = await res.json()
    if (data.holidays?.length > 0) return data.holidays
  } catch {
    // API 없으면 로컬 데이터 사용
  }
  return HOLIDAY_DATA[year] ?? []
}
