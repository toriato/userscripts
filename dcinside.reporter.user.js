// ==UserScript==
// @name          디시인사이드 신문고 버튼
// @namespace     https://github.com/toriato/userscripts/dcinside.reporter.user.js
// @match         https://gall.dcinside.com/board/view/*
// @match         https://gall.dcinside.com/mgallery/board/view/*
// @match         https://gall.dcinside.com/mini/board/view/*
// @run-at        document-end
// @noframes
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// ==/UserScript==

const decodeKey = 'yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBslCt2D3uE4Fv5G6wH178xJ9K'

const params = (new URL(location.href)).searchParams
const gallery = params.get('id')
const article = params.get('no')

function request(d) {
  return new Promise((resolve, reject) => {
    d.onabort = () => reject('사용자가 작업을 취소했습니다')
    d.ontimeout = () => reject('작업 시간이 초과됐습니다')
    d.onerror = reject
    d.onload = resolve
    GM_xmlhttpRequest(d)
  })
}

function decode(keys, code) {
  // common.js?v=210817:858
  const k = Array(4)
  let o = []

  for (let c = 0; c < keys.length;) {
    for (let i = 0; i < k.length; i++)
      k[i] = decodeKey.indexOf(keys.charAt(c++))

    o.push(k[0] << 2 | k[1] >> 4)
    if (k[2] != 64) o.push((15 & k[1]) << 4 | k[2] >> 2)
    if (k[3] != 64) o.push((3 & k[2]) << 6 | k[3])
  }

  keys = o.map(v => String.fromCharCode(v)).join('')

  // common.js?v=210817:862
  const fi = parseInt(keys.charAt())
  keys = (fi + (fi > 5 ? -5 : 4)) + keys.slice(1)

  // common.js?v=210817:859
  o = [code.slice(0, -10)]

  keys
    .split(',')
    .map((v, idx) => {
      const key = parseFloat(v)
      o.push(String.fromCharCode(2 * (key - idx - 1) / (13 - idx - 1)))
    })

  return o.join('')
}

async function findReportArticle() {
  const { response } = await request({
    method: 'POST',
    url: 'https://m.dcinside.com/ajax/response-list',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    responseType: 'json',
    data: `id=${gallery}`
  })

  for (let article of response.gall_list.data) {
    if (article.subject.includes('신문고')) {
      GM_setValue(gallery, article.no)
      return
    }
  }

  throw new Error('신문고 게시글을 찾을 수 없습니다')
}

async function fetchServiceCode() {
  const reportArticleId = GM_getValue(gallery, 0)

  const { responseText, status } = await request({
    method: 'GET',
    url: `https://gall.dcinside.com/mgallery/board/view/?id=${gallery}&no=${reportArticleId}`
  })

  console.log(status)

  if (status !== 200) {
    await findReportArticle()
    return fetchServiceCode()
  }

  return {
    reportArticleId,
    serviceCode: decode(
      responseText.match(/_d\('([^']+)/)[1],
      responseText.match(/service_code" value="([^"]+)/)[1]
    )
  }
}

async function upload(file) {
  const data = new FormData()
  data.set('file', file)

  const { response } = await request({
    method: 'POST',
    url: 'https://siasky.net/skynet/skyfile',
    responseType: 'json',
    data
  })

  if (!response.skylink) {
    throw new Error('업로드에 실패했습니다')
  }

  return `https://siasky.net/${response.skylink}`
}

async function toHTML() {
  const dom = document.querySelector('.write_div').cloneNode(true)
  const promises = []

  for (let img of dom.querySelectorAll('img')) {
    const p = request({
      method: 'GET',
      url: img.src,
      headers: { Referer: 'https://gall.dcinside.com' },
      responseType: 'blob'
    })
      .then(({ response }) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(response)
      }))
      .then(dataUrl => {
        img.src = dataUrl
      })
      .catch(console.error)

    promises.push(p)
  }

  await Promise.all(promises)

  return `
  <!Doctype HTML>
  <html>
    <head>
    <meta charset="UTF-8">
    </head>
    <body>
    ${dom.innerHTML}
    </body>
  </html>
  `
}

async function report() {
  const { reportArticleId, serviceCode } = await fetchServiceCode()

  const lines = [
    `https://m.dcinside.com/board/aoegame/${params.get('no')}`,
  ]

  // 백업
  {
    const html = await toHTML()
    const result = await upload(
      new File([new Blob([html])], 'article.html', { type: 'text/html' }))

    lines.push(result)
  }

  // 제목
  {
    lines.push([
      document.querySelector('.title_headtext').textContent.trim(),
      document.querySelector('.title_subject').textContent.trim()
    ].join(' '))
  }

  // 작성자 정보
  {
    const { dataset } = document.querySelector('.gall_writer')
    lines.push(`${dataset.nick} (${dataset.uid}${dataset.ip})`)
  }

  const payload = {
    _GALLTYPE_: 'M',
    id: 'aoegame',
    no: reportArticleId,
    name: '신문고',
    password: (Math.random() + 1).toString(36).substring(2),
    memo: lines.join('\n'),
    check_6: 1,
    check_7: 1,
    check_8: 1,
    check_9: 1,
    service_code: serviceCode,
  }

  const { responseText } = await request({
    method: 'POST',
    url: 'https://gall.dcinside.com/board/forms/comment_submit',
    headers: {
      Referer: 'https://gall.dcinside.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: Object.entries(payload).map(v => v.join('=')).join('&')
  })

  if (!responseText.match(/^\d+$/)) {
    alert(responseText)
    return
  }

  alert('신문고에 댓글을 올렸습니다')
}

document.querySelector('.btn_report').addEventListener('click', report)
