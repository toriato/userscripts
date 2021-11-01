// ==UserScript==
// @name        dcinside.macro.downvote.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.macro.downvote.user.js
// @description 디시인사이드 게시글 목록 페이지를 열어두면 새로 올라오는 글마다 자동으로 비추를 남깁니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/board/lists
// @match       https://gall.dcinside.com/mgallery/board/lists
// @match       https://gall.dcinside.com/mini/board/lists
// @grant       GM_xmlhttpRequest
// @noframes
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.macro.downvote.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

function p(d) {
  return new Promise((resolve, reject) => {
    d.onabort = () => reject('사용자가 작업을 취소했습니다')
    d.ontimeout = () => reject('작업 시간이 초과됐습니다')
    d.onerror = reject
    d.onload = resolve
    GM_xmlhttpRequest(d)
  })
}

function fetch(id) {
  return p({
    url: 'https://m.dcinside.com/ajax/response-list',
    method: 'POST',
    responseType: 'json',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'id=' + id,
  })
}

function vote(id, no) {
  const ci_t = ('; ' + document.cookie).split('; ci_c=').pop().split(';').shift()

  return p({
    url: 'https://gall.dcinside.com/board/recommend/vote',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `?id=${id}&no=${no}`,
      Cookie: `PHPSESSID=1; ci_c=${ci_t}; ${id}${no}_Firstcheck_down=Y`,
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: new URLSearchParams({ ci_t, id, no, mode: 'D', link_id: id }).toString(),
  })
}

const wait = t => new Promise(r => setTimeout(r, t))
const gallery = new URL(location.href).searchParams.get('id')
const caches = GM_getValue(gallery, []);

(async () => {
  while (true) {
    try {
      const result = await fetch(gallery)
      const articles = result.response.gall_list.data.filter(v => !caches.includes(v.no))

      for (let article of articles) {
        await Promise.all([
          vote(gallery, article.no),
          wait(1000)
        ])

        if (caches.push(article.no) >= 100) {
          caches.shift()
        }

        GM_setValue(gallery, caches)

        console.log(`[downvoteFairy.user.js] ✔️ ${article.no}: ${decodeURIComponent(article.subject)}`)
      }
    } catch (e) {
      console.error(`[downvoteFairy.user.js] ❗ ${e.message}`, e)
    } finally {
      await wait(1000)
    }
  }
})()