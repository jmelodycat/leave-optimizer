// Vercel 서버리스 함수 - data.go.kr 특일 정보 API 프록시 (한국천문연구원 제공)
// API 키는 Vercel 환경변수 DATA_GO_KR_API_KEY에 저장 (Decoding 키)

const ENDPOINT = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo'
const RATE_LIMIT_CODE = '23' // 초당 호출 한도 초과

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 공공데이터포털은 키 오류나 호출 한도 초과도 200 응답의 JSON으로 돌려준다.
// 정상 응답은 response.header.resultCode가 '00'이다. 한도 초과면 잠깐 쉬고 다시 시도한다.
async function callApi(serviceKey, year, month) {
  const url = new URL(ENDPOINT)
  url.searchParams.set('ServiceKey', serviceKey)
  url.searchParams.set('solYear', year)
  if (month) url.searchParams.set('solMonth', month)
  url.searchParams.set('numOfRows', month ? '50' : '100')
  url.searchParams.set('_type', 'json')

  let error = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(500 * attempt)
    try {
      const data = await fetch(url.toString()).then(r => r.json())
      const auth = data?.OpenAPI_ServiceResponse?.cmmMsgHeader
      if (auth) {
        error = `${auth.errMsg} (${auth.returnReasonCode})`
        if (auth.returnReasonCode === RATE_LIMIT_CODE) continue
        return { error, fatal: true }
      }
      const header = data?.response?.header
      if (header && header.resultCode !== '00') return { error: `${header.resultMsg} (${header.resultCode})`, fatal: true }
      const items = data?.response?.body?.items?.item
      const list = !items ? [] : Array.isArray(items) ? items : [items]
      return { list }
    } catch (err) {
      error = err.message
    }
  }
  return { error }
}

function toHolidays(list) {
  return list
    .filter(h => h.isHoliday === 'Y')
    .map(h => {
      const d = String(h.locdate)
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, name: h.dateName }
    })
}

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
    const errors = new Set()
    let failedMonths = 0
    let holidays = []

    // 1) 연도 단위로 한 번에 받아 본다. 호출이 1건이라 한도에 걸릴 일이 거의 없다.
    const whole = await callApi(serviceKey, year)
    if (whole.error) errors.add(whole.error)

    if (whole.list?.length) {
      holidays = toHolidays(whole.list)
    } else if (!whole.fatal) {
      // 2) 연도 단위가 안 되거나 비어 있으면 달별로 순서대로 받는다(동시에 보내지 않는다).
      for (let m = 1; m <= 12; m++) {
        const r = await callApi(serviceKey, year, String(m).padStart(2, '0'))
        if (r.error) { errors.add(r.error); failedMonths++ } else holidays.push(...toHolidays(r.list))
        await sleep(150)
      }
    }

    // 일부라도 실패했으면 오래 캐시하지 않는다. 빠진 날은 화면 쪽 내장 데이터가 메운다.
    const failed = failedMonths > 0 || (whole.error && !holidays.length)
    res.setHeader('Cache-Control', failed ? 's-maxage=300' : 's-maxage=86400')
    res.json({ holidays, failedMonths, upstreamErrors: [...errors] })
  } catch (err) {
    res.status(500).json({ error: err.message, holidays: [] })
  }
}
