// ==UserScript==
// @name        dcinside.list.preview.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.list.preview.user.js
// @description 디시인사이드 갤러리 목록에서 제목 위에 커서를 올려 게시글을 미리 열람합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @require     https://github.com/toriato/userscripts/raw/master/library/fetch.js
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
    position: fixed;
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
    max-height: 100px;
    cursor: pointer;
  }
  .preview img.active {
    max-height: 100%;
  }

  .preview[data-id][data-no] {
    display: block;
  }
`)

const $preview = document.createElement('div')
$preview.classList.add('preview')
$preview.innerHTML = 'Hello, World!'
document.body.appendChild($preview)

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

  // 현재 미리보는 게시글과 일치한다면 작업 종료하기
  if ($preview.dataset.id === selectedGalleryId && $preview.dataset.no === selectedArticleId)
    return

  // 미리보기 요소 아이디와 게시글 번호 변경하기
  $preview.dataset.id = selectedGalleryId
  $preview.dataset.no = selectedArticleId

  // 미리보기 요소 위치 미리 계산해두기
  let { x, y } = e
  {
    const rect = $preview.getBoundingClientRect()

    // 마우스 커서 우측에 공간 만들기
    x += 100

    // 페이지 우측 넘어가지 않게 조절
    if (x + rect.width > window.innerWidth)
      x = window.innerWidth - rect.width

    // 페이지 상단 넘어가지 않게 조절
    if (y < 0)
      y = 0

    // 페이지 하단 넘어가지 않게 조절
    if (y + rect.height > window.innerHeight)
      y = window.innerHeight - rect.height
  }

  // 디시인사이드 모바일 웹 페이지를 통해 게시글 본문 내용 불러오기
  fetch({
    url: `https://m.dcinside.com/board/${selectedGalleryId}/${selectedArticleId}`,
    headers: { 'User-Agent': '(Android)' }
  }).then(({ responseText }) => {
    // 본문을 불러온 뒤 다른 게시글이 선택됐다면 무시하기
    if ($preview.dataset.id !== selectedGalleryId || $preview.dataset.no !== selectedArticleId)
      return

    // 미리보기 요소 위치 설정하기
    $preview.style.left = x + 'px'
    $preview.style.top = y + 'px'

    // 미리보기 요소 속에 본문 내용 넣기
    {
      const $wrapper = document.createElement('html')
      $wrapper.innerHTML = responseText
      $preview.innerHTML = $wrapper.querySelector('.thum-txtin').innerHTML

      for (let $img of $preview.querySelectorAll('img[data-original]')) {
        $img.setAttribute('src', $img.dataset.original)
        $img.addEventListener('click', () => $img.classList.toggle('active'))
      }
    }
  })
})
