// ==UserScript==
// @name        dcinside.reporter.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.reporter.user.js
// @description 디시인사이드에서 신문고 글이 있는 마이너 또는 미니 갤러리에 신고 댓글을 자동으로 만들어 올려주는 버튼을 추가합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/mgallery/board/view/*
// @match       https://gall.dcinside.com/mini/board/view/*
// @match       https://m.dcinside.com/board/*
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.reporter.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

/**
 * @typedef Article
 * @property {string} galleryId   갤러리 아이디
 * @property {string} articleId   게시글 번호
 * @property {string} username    작성자 아이디 또는 아이피
 * @property {string} nickname    작성자 닉네임
 * @property {string} category    말머리
 * @property {string} subject     제목
 * @property {string} content     내용
 * @property {Object[]} attachments 첨부 파일
 * @property {string} createdAt   작성 시간
 * @property {number} createdAtTimestamp 작성 시간 (유닉스 타임스탬프)
 */

/** 서비스 코드 복호화를 위한 전역 디코드 키 */
const KEY = 'yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBslCt2D3uE4Fv5G6wH178xJ9K'

/** Sia Skynet 업로드 주소 */
const SKYNET_ENDPOINT_UPLOAD = 'https://siasky.net'

/** Sia Skynet 다운로드 주소 */
const SKYNET_ENDPOINT_DOWNLOAD = 'https://siasky.net'

/** 신문고 익명 댓글 닉네임 */
const COMMENT_NICKNAME = 'ㅇㅇ'

/** 신문고 익명 댓글 비밀번호, 비어있다면 무작위 생성 */
const COMMENT_PASSWORD = null

/** 항상 익명으로 신문고 댓글을 작성할지? */
const ALWAYS_ANONYMOUS = false

/** 게시글 백업 디렉터리 내 index.html */
const INDEX = /*html*/`
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
    <li>
      <b><a href="https://github.com/toriato/userscripts/blob/master/dcinside.reporter.user.js">dcinside.reporter.user.js</a></b>
      by
      <b><a href="https://gallog.dcinside.com/springkat">애옹이도둑</a></b>
    </li>
    <li><a href="index.json">메타데이터 받기 (JSON)</a></li>
    <li><a href="attachments">첨부 파일 받기 (ZIP)</a></li>
  </ul>

  <article>
    <h3 class="title">
      <span data-property="category"></span>
      <span data-property="subject"></span>
    </h3>
    <div class="summary">
      <p><span data-property="nickname"></span> (<span data-property="username"></span>)</p>
    </div>
    <div data-property="content"></div>
  </article>
  <script>
    fetch('index.json')
      .then(res => res.json())
      .then(metadata => {
        for (let element of document.querySelectorAll('[data-property]')) {
          const key = element.dataset.property

          if (!(key in metadata.article))
            continue
          
          element.innerHTML = metadata.article[key]
        }
      })
      .catch(e => {
        alert('메타데이터를 불러오는 중 오류가 발생했습니다:\\n' + e.message)
        console.error(e)
      })
  </script>
</body>
</html>
`

/** 파일 확장명 <-> MIME 종류 맵핑 변수 */
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

// 현재 페이지 갤러리 아이디와 게시글 번호 가져오기
const isMobile = location.hostname.startsWith('m.dcinside.com')
const params = (new URL(location.href)).searchParams
let galleryId = params.get('id')
let articleId = params.get('no')

// 모바일 페이지에선 주소에서 값 가져오기
if (isMobile) {
  [galleryId, articleId] = location.pathname.replace(/^\/board\//, '').split('/', 2)
}

/**
 * 난독화된 디시인사이드 서비스 코드를 복호화합니다
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
      k[i] = KEY.indexOf(keys.charAt(c++))

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
 * 무작위 문자열을 생성합니다
 * @returns {string} 무작위 문자열
 */
function generateRandomString() {
  return (Math.random() + 1).toString(36).substring(2)
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
 * 비동기로 웹 요청을 실행합니다
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function fetch(options) {
  return new Promise((resolve, reject) => {
    options.onabort = () => reject('사용자가 작업을 취소했습니다')
    options.ontimeout = () => reject('작업 시간이 초과됐습니다')
    options.onerror = reject
    options.onload = resolve
    GM_xmlhttpRequest(options)
  })
}

/**
 * 현재 페이지에서 글 정보를 가져옵니다
 * @returns {Article}
 */
function fetchArticle() {
  /** @type {Article} */
  const article = { galleryId, articleId, attachments: [] }

  if (isMobile) {

  } else {
    // 작성자 정보
    const author = document.querySelector('.gall_writer')
    article.username = author.dataset.uid + author.dataset.ip
    article.nickname = author.dataset.nick

    // 말머리와 제목
    article.category = document.querySelector('.title_headtext').textContent.trim()
    article.subject = document.querySelector('.title_subject').textContent.trim()

    // 내용
    article.content = document.querySelector('.write_div').innerHTML
  }

  return article
}

/**
 * 현재 갤러리의 신문고 글을 찾아 유저스크립트 저장 공간에 저장합니다
 * @returns {Promise<void>}
 */
async function fetchReportArticle() {
  // 모바일 디시인사이드 API 로 글 목록 불러오기
  const { response } = await fetch({
    method: 'POST',
    url: 'https://m.dcinside.com/ajax/response-list',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    responseType: 'json',
    data: new URLSearchParams({ id: galleryId }).toString()
  })

  for (let article of response.gall_list.data) {
    // 공지 글은 가장 상단에 위치하므로 처음으로 찾은 신문고 글 사용하기
    if (article.subject.includes('신문고')) {
      // 유저스크립트 저장 공간에 신문고 글 번호 저장하기
      GM_setValue(galleryId, article.no)
      return
    }
  }

  // 찾을 수 없다면 오류 반환하기
  throw new Error('신문고 게시글을 찾을 수 없습니다')
}

/**
 * 신문고 글 페이지에서 서비스 코드를 가져옵니다
 * @returns {Promise<string>} 복호화된 서비스 코드
 */
async function fetchServiceCode() {
  const reportArticleId = GM_getValue(galleryId, 0)

  const { responseText, status } = await fetch({
    method: 'GET',
    // TODO: 미니 갤러리 지원하기, 엔드포인트 지정 필요 (/mgallery -> /mini)
    url: `https://gall.dcinside.com/mgallery/board/view/?id=${galleryId}&no=${reportArticleId}`
  })

  // 삭제됐거나 존재하지 않는 글이라면 신문고 글 새로 찾은 뒤 함수 재실행하기
  if (status !== 200) {
    await fetchReportArticle()
    return fetchServiceCode()
  }

  // 난독화된 서비스 코드 복호화하기
  return deobfuscate(
    responseText.match(/_d\('([^']+)/)[1], // 자바스크립트 단에 있는 난독화된 키
    responseText.match(/service_code" value="([^"]+)/)[1] // 폼 데이터
  )
}

/**
 * 현재 글에 포함된 파일과 본문 내용을 File 배열로 변환합니다
 * @param {Article} article 게시글 정보
 * @returns {Promise<File[]>}
 */
async function articleToFiles(article) {
  const currentDate = new Date()
  const metadata = {
    href: location.href,
    article,
    backupAt: currentDate.toString(),
    backupAtTimestamp: +currentDate,
  }

  // 중복 업로드 방지를 위해 해시 기준으로 파일 임시 보관하기
  // 비동기로 작동하므로 딱히 트래픽을 줄여주진 않음
  const hashs = {}

  // 본문에 포함된 파일을 비동기로 불러와야하므로 비동기 배열 준비하기
  const promises = []

  // 본문 내용 후 처리 시작하기
  const content = document.createElement('div')
  content.innerHTML = metadata.article.content

  // 원본 주소를 가지고 있는 모든 요소를 파일로 백업하기
  for (let element of content.querySelectorAll('[src]')) {
    const url = element.getAttribute('src')
    const p = fetch({
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

          metadata.article.attachments.push(attachment)

          // 기존 요소의 원본 주소를 업로드할 파일 경로로 변경하기
          element.setAttribute('src', hashs[hash].name)
        }
      )
      .catch(console.error)

    promises.push(p)
  }

  // 모든 비동기 작업 대기하기
  await Promise.all(promises)

  // 후 처리 끝난 본문 내용 메타데이터에 저장하기
  metadata.article.content = content.innerHTML

  const files = Object.values(hashs)

  files.push(
    new File([new Blob([INDEX])], 'index.html', { type: 'text/html' }))

  files.push(
    new File([new Blob([JSON.stringify(metadata)])], 'index.json', { type: 'application/json' }))

  return files
}

/**
 * Sia Skynet 에 여러 파일을 업로드합니다
 * @param {File[]} files 
 * @returns {Promise<string>} Skylink
 */
async function submitFilesToSkynet(files) {
  const data = new FormData()

  for (let file of files) {
    data.append('files[]', file)
  }

  const { response } = await fetch({
    method: 'POST',
    url: SKYNET_ENDPOINT_UPLOAD + '/skynet/skyfile?filename=undefined',
    responseType: 'json',
    data
  })

  if (!response.skylink) {
    throw new Error('스카이넷 파일 업로드에 실패했습니다')
  }

  return response.skylink
}

/**
 * 새 댓글을 만듭니다
 * @param {Object} payload 
 * @returns {Promise<string>} 작성된 새 댓글 아이디
 */
async function submitComment(payload) {
  const { responseText } = await fetch({
    method: 'POST',
    url: 'https://gall.dcinside.com/board/forms/comment_submit',
    // anonymous 옵션이 true 라면 기존 쿠키를 전송하지도 반환된 쿠키를 저장하지도 않음
    anonymous: ALWAYS_ANONYMOUS,
    // 댓글 작성 요청할 때 서버에서 확인하는 필수 헤더들
    headers: {
      Referer: 'https://gall.dcinside.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: new URLSearchParams(payload).toString()
  })

  // 댓글이 정상적으로 작성됐다면 댓글 번호를 반환해주므로
  // 모두 숫자가 아니라면 오류로 처리하기
  if (!responseText.match(/^\d+$/)) {
    throw new Error(responseText)
  }

  return parseInt(responseText, 10)
}

async function submitReport() {
  const article = fetchArticle()
  const payload = {
    // 갤러리 종류: 마이너 'M', 미니 'MI'
    _GALLTYPE_: 'M',

    // 갤러리 아이디와 게시글 번호
    id: galleryId,
    no: GM_getValue(galleryId),

    // 유동일 때 사용되는 작성자 정보
    name: COMMENT_NICKNAME,
    password: COMMENT_PASSWORD ? COMMENT_PASSWORD : generateRandomString(),

    // 댓글 내용
    memo: '',

    // 아마도... 중복 댓글인지 확인하기 위한 페이로드, 무작위 값을 넣을 필요는 없음
    check_6: generateRandomString(),
    check_7: generateRandomString(),
    check_8: generateRandomString(),
    check_9: generateRandomString(),

    // 자동 입력을 방지하기 위해 클라이언트 측에서 복호화 처리하는 토큰 비스무리한 값
    service_code: null,
  }

  let skylink

  await Promise.all([
    fetchServiceCode()
      .then(code => payload.service_code = code),

    articleToFiles(article)
      .then(files => submitFilesToSkynet(files))
      .then(v => skylink = v)
  ])

  if (!payload.service_code) {
    return
  }

  // 게시글 작성자 정보와 말머리, 제목
  payload.memo += `${article.nickname} (${article.username}) ${article.category} ${article.subject}`

  // 원본 게시글 주소
  payload.memo += `\nhttps://m.dcinside.com/board/${article.galleryId}/${article.articleId}`

  // 백업 게시글 주소
  payload.memo += `\n${SKYNET_ENDPOINT_DOWNLOAD}/${skylink}`

  // 신문고 글에 댓글 작성하기
  const reportCommentId = await submitComment(payload)
  return reportCommentId
}

document.querySelector('.btn_report')
  .addEventListener('click', () => {
    submitReport()
      .then(reportCommentId => alert('신문고에 새 댓글을 올렸습니다: ' + reportCommentId))
      .catch(e => {
        alert('신문고 댓글 작성 중 오류가 발생했습니다:\n' + e.message)
        console.error(e)
      })
  })
