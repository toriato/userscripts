// ==UserScript==
// @name        dcinside.list.refresher.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.list.refresher.user.js
// @description 디시인사이드 갤러리 목록을 자동으로 새로 고칩니다
// @author      Sangha Lee <totoriato@gmail.com>
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/board/lists*
// @match       https://gall.dcinside.com/mgallery/board/lists*
// @match       https://gall.dcinside.com/mini/board/lists*
// @run-at      document-end
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.list.refresher.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

(async () => {
  while (true) {
    await fetch(location.href)
      .then(res => res.text())
      .then(html => {
        const dom = document.createElement('html')
        dom.innerHTML = html
        document.querySelector('.gall_list').innerHTML = dom.querySelector('.gall_list').innerHTML
      })
      .catch(console.error)

    await new Promise(r => setTimeout(r, 1000))
  }
})()
