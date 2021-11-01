// ==UserScript==
// @name        dcinside.macro.downvote.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.macro.downvote.user.js
// @description 디시인사이드 게시글 목록 페이지를 열어두면 새로 올라오는 글마다 자동으로 비추를 남깁니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @require     https://github.com/toriato/userscripts/raw/master/library/fetch.js
// @match       https://gall.dcinside.com/board/lists
// @match       https://gall.dcinside.com/mgallery/board/lists
// @match       https://gall.dcinside.com/mini/board/lists
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @noframes
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.macro.downvote.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

const wait = t => new Promise(r => setTimeout(r, t))
const gallery = new URL(location.href).searchParams.get('id')
const caches = GM_getValue(gallery, []);

function fetchArticles(id) {
  return fetch({
    method: 'POST',
    url: 'https://m.dcinside.com/ajax/response-list',
    responseType: 'json',
    anonymous: true,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'id=' + id,
  })
}

function vote(id, no) {
  const ci_t = ('; ' + document.cookie).split('; ci_c=').pop().split(';').shift()

  return fetch({
    method: 'POST',
    url: 'https://gall.dcinside.com/board/recommend/vote',
    anonymous: true,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `?id=${id}&no=${no}`,
      Cookie: `PHPSESSID=1; ci_c=${ci_t}; ${id}${no}_Firstcheck_down=Y`,
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: new URLSearchParams({ ci_t, id, no, mode: 'D', link_id: id }).toString(),
  })
}

(async () => {
  while (true) {
    try {
      const result = await fetchArticles(gallery)
      const articles = result.response.gall_list.data.filter(v => !caches.includes(v.no))

      for (let article of articles) {
        await Promise.all([
          vote(gallery, article.no),
          wait(1000)
        ])

        // 캐시된 게시글 번호가 너무 많으면 가장 먼저 추가된 번호부터 지우기
        if (caches.push(article.no) >= 100)
          caches.shift()

        // 캐시 저장하기
        GM_setValue(gallery, caches)

        console.log(`[downvote.user.js] ✔️ ${article.no}: ${decodeURIComponent(article.subject)}`)
      }
    } catch (e) {
      console.error(`[downvote.user.js] ❗ ${e.message}`, e)
    } finally {
      await wait(1000)
    }
  }
})()
