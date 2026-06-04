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

    const monthResults = await Promise.all(monthRequests)

    const holidays = monthResults.flatMap(m => {
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

    res.setHeader('Cache-Control', 's-maxage=86400') // 하루 캐시
    res.json({ holidays })
  } catch (err) {
    res.status(500).json({ error: err.message, holidays: [] })
  }
}
