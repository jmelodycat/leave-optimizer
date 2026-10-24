// Vercel 서버리스 함수 - data.go.kr API 프록시
// API 키는 Vercel 환경변수 DATA_GO_KR_API_KEY에 저장

export default async function handler(req, res) {
  const { year } = req.query
  const serviceKey = process.env.DATA_GO_KR_API_KEY

  if (!serviceKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다', holidays: [] })
  }

  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: '연도가 올바르지 않습니다' })
  }

  try {
    const monthRequests = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0')
      const url = new URL('http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo')
      url.searchParams.set('ServiceKey', serviceKey)
      url.searchParams.set('solYear', year)
      url.searchParams.set('solMonth', month)
      url.searchParams.set('numOfRows', '50')
      url.searchParams.set('_type', 'json')
      return fetch(url.toString()).then(r => r.json())
    })

    // 달 하나가 실패해도 나머지 달은 쓴다. 빠진 달은 화면 쪽 내장 데이터가 메운다.
    const settled = await Promise.allSettled(monthRequests)
    const monthResults = settled.filter(r => r.status === 'fulfilled').map(r => r.value)
    // 공공데이터포털은 키 오류나 호출 한도 초과도 200 응답의 JSON으로 돌려준다. 정상 응답은 header.resultCode가 '00'이다.
    const upstreamErrors = new Set()
    const validResults = monthResults.filter(m => {
      const authErr = m?.OpenAPI_ServiceResponse?.cmmMsgHeader
      if (authErr) { upstreamErrors.add(`${authErr.errMsg} (${authErr.returnReasonCode})`); return false }
      const header = m?.response?.header
      if (header && header.resultCode !== '00') { upstreamErrors.add(`${header.resultMsg} (${header.resultCode})`); return false }
      return true
    })
    const failedMonths = settled.length - validResults.length

    const holidays = validResults.flatMap(m => {
      const items = m?.response?.body?.items?.item
      if (!items) return []
      return (Array.isArray(items) ? items : [items])
        .filter(h => h.isHoliday === 'Y')
        .map(h => {
          const d = String(h.locdate)
          const dateStr = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
          return { date: dateStr, name: h.dateName }
        })
    })

    // 일부 달이 실패했으면 오래 캐시하지 않는다
    res.setHeader('Cache-Control', failedMonths ? 's-maxage=300' : 's-maxage=86400')
    res.json({ holidays, failedMonths, upstreamErrors: [...upstreamErrors] })
  } catch (err) {
    res.status(500).json({ error: err.message, holidays: [] })
  }
}
