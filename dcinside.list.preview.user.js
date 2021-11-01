// ==UserScript==
// @name        dcinside.list.preview.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.list.preview.user.js
// @description 디시인사이드 갤러리 목록에서 제목 위에 커서를 올려 게시글을 미리 열람합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/board/lists*
// @match       https://gall.dcinside.com/mgallery/board/lists*
// @match       https://gall.dcinside.com/mini/board/lists*
// @run-at      document-end
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.list.preview.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

GM_addStyle(/*css*/`
  .preview {
    display: none;
    position: absolute;
    overflow: hidden;
    overflow-y: auto;
    top: 0;
    left: 0;
    z-index: 100;
    width: 400px;
    height: 300px;
    padding: 1em;
    box-sizing: border-box;
    box-shadow: 0 0 10px black;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    color: white;
  }
  .preview img {
    max-width: 100%;
    max-height: 50px;
  }

  .preview[data-id][data-no] {
    display: block;
  }
`)

const $preview = document.createElement('div')
$preview.classList.add('preview')
$preview.innerHTML = 'Hello, World!'
document.body.appendChild($preview)

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

document.addEventListener('mousemove', e => {
  // 커서가 미리보기 요소 위에 있다면 작업 무시하기
  if (e.target.closest('.preview'))
    return

  // 커서가 게시글 요소 위에 없다면 미리보기 요소 숨기기
  /** @type {HTMLElement} */
  const $article = e.target.closest('.us-post')
  if (!$article) {
    delete $preview.dataset.id
    delete $preview.dataset.no
    return
  }

  // 게시글 요소 주소에서 갤러리 아이디와 게시글 번호 가져오기
  const href = $article.querySelector('.gall_tit > a').href
  const params = new URLSearchParams(href.split('?').pop())

  const selectedGalleryId = params.get('id')
  const selectedArticleId = params.get('no')

  const currentGalleryId = $preview.dataset.id
  const currentArticleId = $preview.dataset.no

  // 현재 미리보는 게시글과 일치한다면 작업 종료하기
  if (currentGalleryId === selectedGalleryId && currentArticleId === selectedArticleId)
    return

  // 미리보기 요소 아이디와 게시글 번호 변경하기
  $preview.dataset.id = selectedGalleryId
  $preview.dataset.no = selectedArticleId

  // 디시인사이드 모바일 웹 페이지를 통해 게시글 본문 내용 불러오기
  fetch({
    method: 'GET',
    url: `https://m.dcinside.com/board/${selectedGalleryId}/${selectedArticleId}`,
    headers: { 'User-Agent': '(Android)' }
  })
    // 미리보기 요소 속에 본문 내용 넣기
    .then(({ responseText }) => {
      const $ = document.createElement('html')
      $.innerHTML = responseText

      const $content = $.querySelector('.thum-txtin')

      for (let $element of $content.querySelectorAll('[data-original]')) {
        $element.setAttribute('src', $element.dataset.original)
      }

      $preview.innerHTML = $content.innerHTML
    })
    // 미리보기 요소 위치 다시 계산하기
    .then(() => {
      const previewRect = $preview.getBoundingClientRect()
      const articleRect = $article.getBoundingClientRect()
      const bodyRect = document.body.getBoundingClientRect()

      let x = e.pageX
      let y = window.scrollY + articleRect.top - previewRect.height / 2

      // 마우스 커서 우측에 공간 만들기
      x += 100

      // 페이지 우측 넘어가지 않게 조절
      if (x + previewRect.width > bodyRect.width)
        x = bodyRect.width - previewRect.width

      // 페이지 상단 넘어가지 않게 조절
      if (y < window.scrollY)
        y = window.scrollY

      // 페이지 하단 넘어가지 않게 조절
      if (y + previewRect.height > window.scrollY + window.innerHeight)
        y = window.scrollY + window.innerHeight - previewRect.height

      // 미리보기 요소 위치 설정하기
      $preview.style.left = x + 'px'
      $preview.style.top = y + 'px'
    })

})
