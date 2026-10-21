import { useState, useEffect, useMemo } from 'react'
import { fetchHolidays } from './data/holidays'
import {
  findOpportunities,
  getBreakdown,
  findWindowIncluding,
  getAllDates,
  buildOffDaySet,
  formatDateKo,
  formatRangeKo,
  isWeekend,
} from './utils/optimizer'

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_MONTH = NOW.getMonth()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]
const MAX_YEAR = CURRENT_YEAR + 2
const MAX_MONTH = CURRENT_MONTH  // 3년 후 같은 달까지

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function makeDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── 월간 캘린더 ──────────────────────────────────────────────
function MonthCalendar({ year, month, holidays, highlightStart, highlightEnd, leaveDates, clickedDate, onDateClick }) {
  const holidayMap = useMemo(() => {
    const m = {}
    holidays.forEach(h => { m[h.date] = h })
    return m
  }, [holidays])

  const leaveSet = useMemo(() => new Set(leaveDates ?? []), [leaveDates])

  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = makeDateStr(year, month, d)
    cells.push({
      day: d, ds,
      isToday: ds === todayStr,
      holiday: holidayMap[ds],
      inRange: highlightStart && highlightEnd && ds >= highlightStart && ds <= highlightEnd,
      isLeave: leaveSet.has(ds),
      isClicked: ds === clickedDate,
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DOW.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-2.5
            ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 칸 */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          if (!cell) return (
            <div key={i} className="min-h-[70px] border-b border-r border-slate-50 bg-slate-50/30" />
          )

          const { day, ds, isToday, holiday, inRange, isLeave, isClicked } = cell
          const col = i % 7
          const isPast = ds < todayStr && !isToday

          let bg = ''
          if (!isPast && isLeave)      bg = 'bg-amber-50'
          else if (!isPast && inRange) bg = 'bg-indigo-50'

          let numCls = isPast ? 'text-slate-300' : 'text-slate-700'
          if (!isPast) {
            if (isLeave)        numCls = 'text-amber-700 font-bold'
            else if (holiday)   numCls = 'text-red-400'
            else if (col === 0) numCls = 'text-red-400'
            else if (col === 6) numCls = 'text-blue-400'
            else if (inRange)   numCls = 'text-indigo-700'
          }

          const holName = holiday?.name.replace(' 대체공휴일', '*').replace(' 연휴', '') ?? ''

          return (
            <div
              key={i}
              onClick={() => !isPast && onDateClick(ds)}
              className={`min-h-[70px] border-b border-r border-slate-100 p-1.5 transition-all
                ${isPast ? 'bg-slate-50/60 cursor-default' : 'cursor-pointer'}
                ${!isPast && bg}
                ${!isPast && isClicked ? 'ring-2 ring-inset ring-amber-400' : ''}
                ${!isPast && !isClicked ? 'hover:brightness-95' : ''}`}
            >
              {/* 날짜 숫자 */}
              <span className={`inline-flex items-center justify-center w-6 h-6 text-sm
                ${isToday
                  ? 'bg-indigo-500 text-white rounded-full font-bold text-xs'
                  : isClicked
                  ? 'bg-amber-500 text-white rounded-full font-bold text-xs'
                  : numCls}`}>
                {day}
              </span>

              {/* 공휴일명 */}
              {holiday && (
                <p className={`text-[10px] leading-tight mt-0.5 font-medium
                  ${isPast ? 'text-slate-300' : isLeave ? 'text-amber-600' : 'text-red-500'}`}>
                  {holName.length > 7 ? holName.slice(0, 7) + '…' : holName}
                </p>
              )}

              {/* 연차 표시 */}
              {!isPast && isLeave && (
                <p className="text-[10px] text-amber-500 font-bold mt-0.5">
                  {holiday ? '★연차' : '연차'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 클릭 모드 패널 ───────────────────────────────────────────
function ClickedPanel({ clickedDate, window: win, onClear }) {
  if (!win) return null
  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-300 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <div>
          <p className="font-bold text-indigo-800 text-sm">
            {formatDateKo(clickedDate)} 기준
          </p>
          <p className="text-xs text-indigo-500 mt-0.5">이 날 포함 최적 휴가</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-indigo-400 hover:text-indigo-600 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-full transition-colors"
        >
          자동 추천으로 ×
        </button>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-bold text-slate-800">{win.totalDays}일</span>
          <span className="text-slate-500 text-sm">연속 휴가</span>
        </div>
        <p className="text-sm text-slate-600 mb-3">{formatRangeKo(win.startDate, win.endDate)}</p>
        {win.leaveDates.length > 0 ? (
          <div className="bg-amber-50 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-700 mb-1">
              연차 {win.leaveUsed}일 사용
            </p>
            <p className="text-xs text-amber-600 leading-relaxed">
              {win.leaveDates.map(d => formatDateKo(d)).join('\n')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">연차 없이도 가능한 기간이에요</p>
        )}
      </div>
    </div>
  )
}

// ─── 자동 추천 패널 ───────────────────────────────────────────
function AutoPanel({ opps, allDates, offDays, maxLeave, selectedOppIdx, onSelectOpp, selectedStepIdx, onSelectStep }) {
  const selectedOpp = selectedOppIdx !== null ? opps[selectedOppIdx] : null

  const breakdown = useMemo(() => {
    if (!selectedOpp) return []
    return getBreakdown(selectedOpp.cluster, allDates, offDays, maxLeave)
  }, [selectedOpp, allDates, offDays, maxLeave])

  if (opps.length === 0) return (
    <p className="text-center text-slate-400 text-sm py-6">이번 달에는 공휴일 연휴 조합이 없어요</p>
  )

  return (
    <div className="space-y-3">
      {opps.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {opps.map((opp, i) => (
            <button key={i} onClick={() => onSelectOpp(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${selectedOppIdx === i
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
              {opp.name}
            </button>
          ))}
        </div>
      )}

      {selectedOpp && breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100">
            <p className="font-bold text-slate-800">{selectedOpp.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              행 선택 또는 달력 날짜를 클릭해 직접 조정할 수 있어요
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {breakdown.map((step, i) => {
              const active = selectedStepIdx === i
              return (
                <button key={i} onClick={() => onSelectStep(i)}
                  className={`w-full text-left px-4 py-3 transition-colors ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-[4.5rem] shrink-0 text-center">
                      {step.leaveCount === 0
                        ? <span className="text-xs text-slate-400">연차 없이</span>
                        : <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full
                            ${active ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700'}`}>
                            연차 {step.leaveCount}일
                          </span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`font-bold text-lg leading-none ${active ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {step.totalDays}일 연속
                        </span>
                        <span className="text-xs text-slate-400">{formatRangeKo(step.startDate, step.endDate)}</span>
                      </div>
                      {step.leaveDates.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          {step.leaveDates.map(d => formatDateKo(d)).join(', ')} 연차
                        </p>
                      )}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors
                      ${active ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 앱 ──────────────────────────────────────────────────
export default function App() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [leaveCount, setLeaveCount] = useState(2)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [selectedOppHint, setSelectedOppHint] = useState(null)
  const [selectedStepIdx, setSelectedStepIdx] = useState(null)

  // 클릭 선택 날짜 (null = 자동 추천 모드)
  const [clickedDate, setClickedDate] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchHolidays(year).then(data => { setHolidays(data); setLoading(false) })
  }, [year])

  // 달/연도 이동 시 초기화
  useEffect(() => {
    setSelectedOppHint(null)
    setSelectedStepIdx(null)
    setClickedDate(null)
  }, [currentMonth, year])

  // 연차 수 변경 시 step 초기화 (자동 최적값)
  useEffect(() => {
    setSelectedStepIdx(null)
  }, [leaveCount])

  const { allDates, offDays } = useMemo(() => ({
    allDates: getAllDates(year),
    offDays: buildOffDaySet(year, holidays),
  }), [year, holidays])

  const allOpps = useMemo(
    () => findOpportunities(year, holidays, leaveCount),
    [year, holidays, leaveCount]
  )

  const monthOpps = useMemo(() => allOpps.filter(opp => {
    const sm = parseInt(opp.startDate.slice(5, 7)) - 1
    const em = parseInt(opp.endDate.slice(5, 7)) - 1
    return currentMonth >= sm && currentMonth <= em
  }), [allOpps, currentMonth])

  const selectedOppIdx = useMemo(() => {
    if (monthOpps.length === 0) return null
    if (selectedOppHint !== null && selectedOppHint < monthOpps.length) return selectedOppHint
    return 0
  }, [monthOpps, selectedOppHint])

  const selectedOpp = selectedOppIdx !== null ? monthOpps[selectedOppIdx] : null

  // 자동 추천 breakdown
  const breakdown = useMemo(() => {
    if (!selectedOpp) return []
    return getBreakdown(selectedOpp.cluster, allDates, offDays, leaveCount)
  }, [selectedOpp, allDates, offDays, leaveCount])

  const effectiveStepIdx = useMemo(() => {
    if (breakdown.length === 0) return null
    if (selectedStepIdx !== null && selectedStepIdx < breakdown.length) return selectedStepIdx
    return breakdown.length - 1
  }, [breakdown, selectedStepIdx])

  const autoDisplayStep = effectiveStepIdx !== null ? breakdown[effectiveStepIdx] : null

  // 클릭 기반 창
  const clickedWindow = useMemo(() => {
    if (!clickedDate || !allDates.length) return null
    return findWindowIncluding(clickedDate, allDates, offDays, leaveCount)
  }, [clickedDate, allDates, offDays, leaveCount])

  // 달력에 표시할 하이라이트 소스
  const displayStep = clickedDate ? clickedWindow : autoDisplayStep

  function handleDateClick(ds) {
    // 같은 날 다시 클릭 → 해제 (자동 모드 복귀)
    setClickedDate(prev => prev === ds ? null : ds)
  }

  const isAtStart = year === CURRENT_YEAR && currentMonth === CURRENT_MONTH
  const isAtEnd = year === MAX_YEAR && currentMonth === MAX_MONTH

  function prevMonth() {
    if (isAtStart) return
    if (currentMonth === 0) { setYear(y => y - 1); setCurrentMonth(11) }
    else setCurrentMonth(m => m - 1)
  }
  function nextMonth() {
    if (isAtEnd) return
    if (currentMonth === 11) { setYear(y => y + 1); setCurrentMonth(0) }
    else setCurrentMonth(m => m + 1)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ① 연차 선택 */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-800">이번 휴가에 쓸 연차</p>
              <p className="text-xs text-slate-400 mt-0.5">슬라이더 조정 또는 달력 날짜 클릭</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setLeaveCount(c => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-600 font-bold transition-colors">−</button>
              <span className="text-2xl font-bold text-indigo-600 w-10 text-center">{leaveCount}</span>
              <button onClick={() => setLeaveCount(c => Math.min(25, c + 1))}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-600 font-bold transition-colors">+</button>
              <span className="text-slate-500 text-sm">일</span>
            </div>
          </div>
          <input type="range" min={1} max={25} value={leaveCount}
            onChange={e => setLeaveCount(Number(e.target.value))}
            className="w-full accent-indigo-500" />
          <div className="flex justify-between text-xs text-slate-300 mt-1"><span>1일</span><span>25일</span></div>
        </div>

        {/* ② 연도 + 월 선택 */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {YEARS.map(y => (
              <button key={y} onClick={() => { setYear(y); setCurrentMonth(y === CURRENT_YEAR ? CURRENT_MONTH : 0) }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${year === y ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-200'}`}>
                {y}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button onClick={prevMonth} disabled={isAtStart}
              className={`w-9 h-9 rounded-xl border font-bold text-lg shadow-sm transition-all
                ${isAtStart
                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-default'
                  : 'bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600'}`}>
              ‹
            </button>
            <span className="text-base font-bold text-slate-800 w-20 text-center">{currentMonth + 1}월</span>
            <button onClick={nextMonth} disabled={isAtEnd}
              className={`w-9 h-9 rounded-xl border font-bold text-lg shadow-sm transition-all
                ${isAtEnd
                  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-default'
                  : 'bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600'}`}>
              ›
            </button>
          </div>
        </div>

        {/* ③ 달력 */}
        {loading ? (
          <div className="h-72 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 text-sm">
            공휴일 불러오는 중...
          </div>
        ) : (
          <>
            <div className="flex gap-3 text-[11px] text-slate-400 justify-between items-center -mb-2">
              <span className="text-slate-400 text-[11px]">날짜 클릭 → 그 날 기준 최적 계획</span>
              <div className="flex gap-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 inline-block" />연차일</span>
                <span className="text-red-400">● 공휴일</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />오늘</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />선택일</span>
              </div>
            </div>

            <MonthCalendar
              year={year}
              month={currentMonth}
              holidays={holidays}
              highlightStart={displayStep?.startDate}
              highlightEnd={displayStep?.endDate}
              leaveDates={displayStep?.leaveDates}
              clickedDate={clickedDate}
              onDateClick={handleDateClick}
            />
          </>
        )}

        {/* ④ 계획 패널 */}
        {!loading && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {currentMonth + 1}월 연차 계획
            </p>

            {clickedDate ? (
              <ClickedPanel
                clickedDate={clickedDate}
                window={clickedWindow}
                onClear={() => setClickedDate(null)}
              />
            ) : (
              <AutoPanel
                opps={monthOpps}
                allDates={allDates}
                offDays={offDays}
                maxLeave={leaveCount}
                selectedOppIdx={selectedOppIdx}
                onSelectOpp={i => { setSelectedOppHint(i); setSelectedStepIdx(null) }}
                selectedStepIdx={effectiveStepIdx}
                onSelectStep={setSelectedStepIdx}
              />
            )}
          </div>
        )}

        <div className="text-center space-y-1 pt-1">
          <p className="text-[11px] text-slate-300">
            공휴일 정보: 한국천문연구원 (data.go.kr)
          </p>
          <a href="https://instagram.com/no_problem.club" target="_blank" rel="noopener"
            className="inline-block text-xs text-slate-400 no-underline">
            made by <span className="text-indigo-500 font-semibold">@no_problem.club</span>
          </a>
        </div>
      </div>
    </div>
  )
}
