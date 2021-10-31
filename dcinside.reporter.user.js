// ==UserScript==
// @name          디시인사이드 신문고 버튼
// @namespace     https://github.com/toriato/userscripts/dcinside.reporter.user.js
// @match         https://gall.dcinside.com/board/view/*
// @match         https://gall.dcinside.com/mgallery/board/view/*
// @match         https://gall.dcinside.com/mini/board/view/*
// @run-at        document-end
// @noframes
// @require       https://unpkg.com/js-sha1@0.6.0/src/sha1.js
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// ==/UserScript==

const decodeKey = 'yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBslCt2D3uE4Fv5G6wH178xJ9K'

const fileExtensions = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  bmp: 'image/bmp',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm'
}

const params = (new URL(location.href)).searchParams
const gallery = params.get('id')
const article = params.get('no')

/**
 * 비동기로 웹 요청을 실행합니다
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function request(options) {
  return new Promise((resolve, reject) => {
    options.onabort = () => reject('사용자가 작업을 취소했습니다')
    options.ontimeout = () => reject('작업 시간이 초과됐습니다')
    options.onerror = reject
    options.onload = resolve
    GM_xmlhttpRequest(options)
  })
}

/**
 * 디시인사이드 서비스 코드를 복호화합니다
 * @param {string} keys 페이지에서 제공한 난독화된 키
 * @param {string} code 난독화된 서비스 코드 (service_code) 
 * @returns {string} 복호화된 서비스 코드
 */
function deobfuscate(keys, code) {
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

/**
 * 현재 갤러리 글 목록에서 신문고 글을 찾아 보관합니다
 * @returns {Promise<void>}
 */
async function findReportArticle() {
  // 모바일 디시인사이드 API 로 글 목록 불러오기
  const { response } = await request({
    method: 'POST',
    url: 'https://m.dcinside.com/ajax/response-list',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    responseType: 'json',
    data: `id=${gallery}`
  })

  for (let article of response.gall_list.data) {
    // 공지 글은 가장 상단에 위치하므로 처음으로 찾은 신문고 글 사용하기
    if (article.subject.includes('신문고')) {
      // 유저스크립트 저장 공간에 신문고 글 번호 저장하기
      GM_setValue(gallery, article.no)
      return
    }
  }

  // 찾을 수 없다면 오류 반환하기
  throw new Error('신문고 게시글을 찾을 수 없습니다')
}

/**
 * 신문고 글 페이지에서 서비스 코드를 가져옵니다
 * @returns {Promise<Object>} 복호화된 서비스 코드
 */
async function fetchServiceCode() {
  const reportArticleId = GM_getValue(gallery, 0)

  const { responseText, status } = await request({
    method: 'GET',
    // TODO: 미니 갤러리 지원하기, 엔드포인트 지정 필요 (/mgallery -> /mini)
    url: `https://gall.dcinside.com/mgallery/board/view/?id=${gallery}&no=${reportArticleId}`
  })

  // 삭제됐거나 존재하지 않는 글이라면 신문고 글 새로 찾은 뒤 함수 재실행하기
  if (status !== 200) {
    await findReportArticle()
    return fetchServiceCode()
  }

  // 난독화된 서비스 코드 복호화하기
  return deobfuscate(
    responseText.match(/_d\('([^']+)/)[1], // 자바스크립트 단에 있는 난독화된 키
    responseText.match(/service_code" value="([^"]+)/)[1] // 폼 데이터
  )
}

/**
 * Blob 의 해시 문자열을 구합니다
 * @param {Blob} blob
 * @returns {Promise<string>} 해시 문자열
 */
async function hashBlob(algorithm, blob) {
  const buffer = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest(algorithm, buffer)
  const hashArray = Array.from(new Uint8Array(hash))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * 현재 글에 포함된 파일과 본문 내용을 File 배열로 변환합니다
 * @returns {Promise<File[]>}
 */
async function articleToFiles() {
  const dom = document.querySelector('.write_div').cloneNode(true)

  const date = new Date()
  const metadata = {
    href: location.href,
    gallery,
    article,
    attachments: [],
    createdAt: date.toString(),
    createdAtTimestamp: +date,
  }

  // 중복 업로드 방지를 위해 해시 기준으로 파일 임시 보관하기
  // 비동기로 작동하므로 딱히 트래픽을 줄여주진 않음
  const hashs = {}

  // 본문에 포함된 파일을 비동기로 불러와야하므로 비동기 배열 준비하기
  const promises = []

  // 원본 주소를 가지고 있는 모든 요소를 파일로 백업하기
  for (let element of dom.querySelectorAll('[src]')) {
    const url = element.getAttribute('src')
    const p = request({
      method: 'GET',
      url,
      headers: { Referer: 'https://gall.dcinside.com' }, // 디시인사이드 이미지는 레퍼 값을 요구
      responseType: 'blob'
    })
      .then(
        async ({ response, responseHeaders }) => {
          const hash = await hashBlob('SHA-1', response)
          const attachment = {
            originalName: null,
            url,
            name: `attachments/${hash}`,
            type: 'application/octet-stream'
          }

          // 서버에서 반환한 헤더 파싱하기
          const headers = {}
          responseHeaders.split('\n').map(line => {
            const [k, v] = line.split(':', 2).map(v => v.trim())
            headers[k] = v
          })

          // 서버에서 반환한 헤더로 파일 이름과 종류 가져오기
          if ('content-disposition' in headers) {
            const attrs = []
            headers['content-disposition'].split(';').map(attr => {
              const [k, v] = attr.split('=', 2).map(v => v.trim())
              attrs[k] = v
            })

            if (attrs.filename) {
              // 따옴표로 감싸있는 경우 첫번째와 마지막 글자 제외하기
              let filename = attrs.filename
              if (filename.match(/^['"]/)) {
                filename = filename.replace(/^.|.$/, '')
              }

              attachment.originalName = filename

              // 파일 이름 중 점으로 나눴을 때 가장 마지막 값을 확장자로 가져오기
              const extension = filename.split('.').pop()

              // 일치하는 MIME 가 있다면 파일 종류 값 설정하기
              if (extension in fileExtensions) {
                attachment.type = fileExtensions[extension]
              }

              attachment.name += '.' + extension
            }
          } else if ('content-type' in headers) {
            // 일치하는 MIME 가 있다면 파일 경로 끝에 확장자 추가하기
            for (let [extension, mime] of Object.entries(fileExtensions)) {
              if (mime === headers['content-type']) {
                attachment.name += '.' + extension
                break
              }
            }

            attachment.type = headers['content-type']
          } else {
            console.warn('파일의 이름과 종류를 유추할 수 있는 값이 반환되지 않았습니다 ')
          }

          // 중복된 파일이 아닌 경우 해시에 추가하기
          if (!(hash in hashs)) {
            hashs[hash] = new File([response], attachment.name, { type: attachment.type })
          }

          metadata.attachments.push(attachment)

          // 기존 요소의 원본 주소를 업로드할 파일 경로로 변경하기
          element.setAttribute('src', hashs[hash].name)
        }
      )
      .catch(console.error)

    promises.push(p)
  }

  // 모든 비동기 작업 대기하기
  await Promise.all(promises)

  const files = Object.values(hashs)

  // 본문을 HTML 형태로 파일 배열에 추가하기
  {
    const html = `
      <!Doctype HTML>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
            }
            body { padding: .5em }
            img { max-width: 100% }
          </style>
        </head>
        <body>
          <ul>
            <li><a href="attachments">모든 첨부파일 받기</a></li>
            <li><a href="index.json">메타데이터 (JSON)</a></li>
          </ul>
          <div id="content">${dom.innerHTML}</div>
        </body>
      </html>
    `

    files.push(
      new File([new Blob([html])], 'index.html', { type: 'text/html' })
    )
  }

  // 메타데이터 추가하기
  files.push(
    new File([new Blob([JSON.stringify(metadata)])], 'index.json', { type: 'application/json' })
  )

  return files
}

/**
 * Sia Skynet 에 여러 파일을 업로드합니다
 * @param {File[]} files 
 * @returns {Promise<string>} Skylink
 */
async function uploadFilesToSkynet(files) {
  const data = new FormData()

  for (let file of files) {
    data.append('files[]', file)
  }

  const { response } = await request({
    method: 'POST',
    url: 'https://siasky.net/skynet/skyfile?filename=undefined',
    responseType: 'json',
    data
  })

  if (!response.skylink) {
    throw new Error('스카이넷 파일 업로드에 실패했습니다')
  }

  return `https://siasky.net/${response.skylink}`
}

async function report() {
  const lines = [`https://m.dcinside.com/board/${gallery}/${article}`]

  {
    const files = await articleToFiles()
    const skylink = await uploadFilesToSkynet(files)
    lines.push(skylink)
  }

  {
    const { dataset } = document.querySelector('.gall_writer')
    const user = `${dataset.nick} (${dataset.uid}${dataset.ip})`
    const head = document.querySelector('.title_headtext').textContent.trim()
    const subject = document.querySelector('.title_subject').textContent.trim()
    lines.push(`${user} / ${head} ${subject}`)
  }

  const code = await fetchServiceCode()
  const payload = {
    _GALLTYPE_: 'M',
    id: gallery,
    no: GM_getValue(gallery),
    name: 'ㅇㅇ',
    password: (Math.random() + 1).toString(36).substring(2),
    memo: lines.join('\n'),
    check_6: 1,
    check_7: 1,
    check_8: 1,
    check_9: 1,
    service_code: code,
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

  // 댓글이 정상적으로 작성됐다면 댓글 번호를 반환해주므로
  // 모두 숫자가 아니라면 오류로 처리하기
  if (!responseText.match(/^\d+$/)) {
    alert(responseText)
    return
  }

  alert('신문고에 댓글을 올렸습니다')
}

document.querySelector('.btn_report').addEventListener('click', report)
