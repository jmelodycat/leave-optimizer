const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 로컬 날짜 기준 문자열. toISOString은 UTC로 바꿔서 한국 시간대에서는 하루씩 밀린다.
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

// startDate~endDate(YYYY-MM-DD, 양 끝 포함)의 날짜 문자열 목록
export function getAllDates(startDate, endDate) {
  const dates = []
  const end = new Date(endDate + 'T00:00:00')
  let d = new Date(startDate + 'T00:00:00')
  while (d <= end) {
    dates.push(toDateStr(d))
    d = addDays(d, 1)
  }
  return dates
}

export function buildOffDaySet(allDates, holidays) {
  const offDays = new Set(holidays.map(h => h.date))
  for (const s of allDates) {
    if (isWeekend(s)) offDays.add(s)
  }
  return offDays
}

// 한 방향으로 확장: off-day는 무료, workday는 leave 소모
function extendDir(fromIdx, dir, budget, allDates, offDays) {
  let idx = fromIdx
  while (true) {
    const next = idx + dir
    if (next < 0 || next >= allDates.length) break
    if (offDays.has(allDates[next])) {
      idx = next
    } else if (budget > 0) {
      budget--
      idx = next
    } else break
  }
  return idx
}

// 범위 내 근무일(연차 필요 일) 목록
function getWorkdays(startIdx, endIdx, allDates, offDays) {
  const days = []
  for (let i = startIdx; i <= endIdx; i++) {
    if (!offDays.has(allDates[i])) days.push(allDates[i])
  }
  return days
}

// 공휴일 off-day run 탐색 (주말만인 run은 제외)
function findHolidayRuns(allDates, offDays, holidays) {
  const holidaySet = new Set(holidays.map(h => h.date))
  const runs = []
  let i = 0
  while (i < allDates.length) {
    if (offDays.has(allDates[i])) {
      let j = i
      while (j < allDates.length && offDays.has(allDates[j])) j++
      const hasHoliday = allDates.slice(i, j).some(d => holidaySet.has(d))
      if (hasHoliday) {
        runs.push({
          startIdx: i,
          endIdx: j - 1,
          holidays: holidays.filter(h => h.date >= allDates[i] && h.date <= allDates[j - 1]),
        })
      }
      i = j
    } else i++
  }
  return runs
}

// 3 workdays 이하 간격 run들 병합 → 하나의 클러스터
function mergeRuns(runs, allDates, offDays, gapThreshold = 3) {
  if (!runs.length) return []
  const merged = [{ ...runs[0] }]
  for (let i = 1; i < runs.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = runs[i]
    let gap = 0
    for (let k = prev.endIdx + 1; k < curr.startIdx; k++) {
      if (!offDays.has(allDates[k])) gap++
    }
    if (gap <= gapThreshold) {
      merged[merged.length - 1] = {
        startIdx: prev.startIdx,
        endIdx: curr.endIdx,
        holidays: [...prev.holidays, ...curr.holidays],
      }
    } else {
      merged.push({ ...curr })
    }
  }
  return merged
}

// 클러스터 대표 이름
function clusterName(cluster) {
  const names = cluster.holidays
    .map(h => h.name)
    .filter(n => !n.includes('대체'))
    .map(n => n.replace(' 연휴', ''))
  const unique = [...new Set(names)].slice(0, 2)
  return unique.join('·') + ' 연휴'
}

export function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`
}

export function formatRangeKo(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  const sm = s.getMonth() + 1, sd = s.getDate()
  const em = e.getMonth() + 1, ed = e.getDate()
  if (sm === em) return `${sm}월 ${sd}일(${DOW[s.getDay()]}) ~ ${ed}일(${DOW[e.getDay()]})`
  return `${sm}월 ${sd}일(${DOW[s.getDay()]}) ~ ${em}월 ${ed}일(${DOW[e.getDay()]})`
}

/**
 * 특정 클러스터의 연차 0~maxLeave일 단계별 조합 반환
 * 각 단계: { leaveCount, totalDays, startDate, endDate, leaveDates }
 */
export function getBreakdown(cluster, allDates, offDays, maxLeave) {
  const { startIdx: natLeft, endIdx: natRight } = cluster

  const steps = []

  for (let k = 0; k <= maxLeave; k++) {
    let best = null

    for (let lb = 0; lb <= k; lb++) {
      const rb = k - lb
      const si = extendDir(natLeft, -1, lb, allDates, offDays)
      const ei = extendDir(natRight, +1, rb, allDates, offDays)
      const leaveDates = getWorkdays(si, ei, allDates, offDays)
      if (leaveDates.length > k) continue

      const totalDays = ei - si + 1
      if (!best || totalDays > best.totalDays) {
        best = {
          leaveCount: leaveDates.length,
          totalDays,
          startDate: allDates[si],
          endDate: allDates[ei],
          leaveDates,
        }
      }
    }

    if (!best) break
    // 이전 단계보다 더 길어진 경우만 추가
    const prev = steps[steps.length - 1]
    if (!prev || best.totalDays > prev.totalDays) {
      steps.push(best)
    }
  }

  return steps
}

/**
 * 날짜 범위·공휴일·최대연차 기준, 모든 클러스터의 최적 조합 반환
 * allDates의 첫 날짜 이전과 마지막 날짜 이후로는 확장하지 않는다
 */
export function findOpportunities(allDates, offDays, holidays, maxLeave) {
  const runs = findHolidayRuns(allDates, offDays, holidays)
  const clusters = mergeRuns(runs, allDates, offDays)

  const results = []

  for (const cluster of clusters) {
    const { startIdx: natLeft, endIdx: natRight } = cluster

    // 최대 연차로 최적 창 탐색
    let best = null
    for (let lb = 0; lb <= maxLeave; lb++) {
      const rb = maxLeave - lb
      const si = extendDir(natLeft, -1, lb, allDates, offDays)
      const ei = extendDir(natRight, +1, rb, allDates, offDays)
      const leaveDates = getWorkdays(si, ei, allDates, offDays)
      if (leaveDates.length > maxLeave) continue
      const totalDays = ei - si + 1
      if (!best || totalDays > best.totalDays) {
        best = {
          startDate: allDates[si],
          endDate: allDates[ei],
          totalDays,
          leaveUsed: leaveDates.length,
          efficiency: leaveDates.length > 0 ? +(totalDays / leaveDates.length).toFixed(1) : null,
          name: clusterName(cluster),
          cluster, // breakdown 계산에 필요
        }
      }
    }

    if (!best) continue

    results.push(best)
  }

  return results.sort((a, b) => (b.efficiency ?? 0) - (a.efficiency ?? 0))
}

// 공휴일 있는 월 목록 반환 (월 필터 pill 표시용)
export function getHolidayMonths(holidays) {
  return new Set(holidays.map(h => parseInt(h.date.slice(5, 7))))
}

/**
 * 특정 날짜를 반드시 포함하는 최대 연속 휴가 계산
 * 클릭한 날 기준으로 좌우 확장 → 연차 N일 이내로 가장 긴 기간
 */
export function findWindowIncluding(anchorDate, allDates, offDays, maxLeave) {
  const ai = allDates.indexOf(anchorDate)
  if (ai === -1) return null

  // 전체 범위에 대한 누적 연차일 수 (prefix sum)
  const prefix = new Array(allDates.length + 1).fill(0)
  for (let i = 0; i < allDates.length; i++) {
    prefix[i + 1] = prefix[i] + (offDays.has(allDates[i]) ? 0 : 1)
  }
  const countLeave = (from, to) => (to >= from ? prefix[to + 1] - prefix[from] : 0)

  let best = null

  for (let i = ai; i >= 0; i--) {
    if (countLeave(i, ai) > maxLeave) break  // 왼쪽만으로도 초과 → 중단

    for (let j = ai; j < allDates.length; j++) {
      const total = countLeave(i, j)
      if (total > maxLeave) break

      const days = j - i + 1
      if (!best || days > best.totalDays || (days === best.totalDays && total < best.leaveUsed)) {
        best = { si: i, ei: j, totalDays: days, leaveUsed: total }
      }
    }
  }

  if (!best) return null

  const leaveDates = allDates.slice(best.si, best.ei + 1).filter(d => !offDays.has(d))
  return {
    startDate: allDates[best.si],
    endDate: allDates[best.ei],
    totalDays: best.totalDays,
    leaveUsed: best.leaveUsed,
    leaveDates,
  }
}
