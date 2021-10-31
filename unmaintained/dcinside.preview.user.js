// ==UserScript==
// @name          디시인사이드 미리보기
// @description   koolside 후속작 (30분 후려치기로 만든거라 원작보다 못함)
// @namespace     https://github.com/toriato/userscripts/dcinside.preview.user.js
// @match         https://gall.dcinside.com/board/lists*
// @match         https://gall.dcinside.com/board/view/*
// @match         https://gall.dcinside.com/mgallery/board/lists*
// @match         https://gall.dcinside.com/mgallery/board/view/*
// @match         https://gall.dcinside.com/mini/board/lists*
// @match         https://gall.dcinside.com/mini/board/view/*
// @run-at        document-end
// @noframes
// @grant         GM_xmlhttpRequest
// @grant         GM_addStyle
// ==/UserScript==

GM_addStyle(`

  .dcpv {
    overflow: auto;
    z-index: 1000;
    position: fixed;
    top: 0;
    left: 0;
    display: none;
    width: 100%;
    max-width: 400px;
    height: 300px;
    padding: 1em;
    box-sizing: border-box;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
  }
  .dcpv.active {
    display: block;
  }

  .dcpv img {
    max-width: 100%;
  }

`)

const params = (new URL(location.href)).searchParams
const request = details => new Promise((resolve, reject) => {
  details.onabort = () => reject('사용자가 작업을 취소했습니다')
  details.ontimeout = () => reject('작업 시간이 초과됐습니다')
  details.onerror = reject
  details.onload = resolve
  GM_xmlhttpRequest(details)
})

// 요소 변수 만들기
const $body = document.querySelector('body')
const $wrapper = document.createElement('div')

// 요소 추가하기
$body.append($wrapper)

// 요소 설정하기
$wrapper.classList.add('dcpv')

$body.addEventListener('mousemove', e => {
  $article = e.target.closest('.ub-content.us-post')

  const isActive = $wrapper.classList.contains('active')

  // 현재 마우스가 게시글 요소에 올라간 상태가 아니라면
  // 미리보기 요소 숨기기
  if (!$article) {
    if (isActive) {
      $wrapper.classList.remove('active')
    }
    return
  }

  const currentArticleId = $article.dataset.no

  // 숨겨진 미리보기 요소를 다시 표시할 때
  if (!isActive) {
    $wrapper.classList.add('active')
    $wrapper.dataset.id = params.get('id')
    $wrapper.dataset.no = $article.dataset.no
  }

  // 미리보기 요소에 있는 글 번호가 마우스 올려진 글 번호가 다를 때
  if ($wrapper.dataset.no !== currentArticleId) {
    $wrapper.dataset.no = $article.dataset.no

    // 요소 위치 변경하기
    let x = e.x
    let y = e.y

    // Offset
    x += 10
    y += 10

    $wrapper.style.top = y + 'px'
    $wrapper.style.left = x + 'px'

    // 웹 요청하기
    request({
      url: `https://m.dcinside.com/board/${$wrapper.dataset.id}/${$wrapper.dataset.no}`,
      method: 'GET',
      headers: { 'User-Agent': '(Android)' }
    })
      .then(res => {
        const $page = document.createElement('html')
        $page.innerHTML = res.response

        const $content = $page.querySelector('.thum-txtin')

        // 불필요한 요소 제거하기
        for (let $element of $content.querySelectorAll('iframe, script')) {
          $element.remove()
        }

        // 이미지 소스 원본으로 교체하기
        for (let $image of $content.querySelectorAll('img[data-original]')) {
          $image.src = $image.dataset.original
        }

        // 미리보기 요소 내용 교체하기
        $wrapper.innerHTML = $content.innerHTML

        history.replaceState({}, '', $article.querySelector('a').href)
      })
      .catch(console.error)
  }
})
