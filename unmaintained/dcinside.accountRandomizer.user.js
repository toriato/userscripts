// ==UserScript==
// @name        DCInside Account Randomizer
// @description 디시인사이드에 글 또는 댓글을 올릴 때 미리 지정해둔 계정 정보 중 아무거나 선택해 적용한 뒤 서버에 전송합니다
// @version     1.0.0
// @author      toriato
// @copyright   2021, Sangha Lee
// @license     MIT
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @require     https://openuserjs.org/src/libs/toriato/Promisified_GM_xmlhttpRequest.min.js
// @require     https://openuserjs.org/src/libs/toriato/XHR_Hooks.min.js
// @match       https://gall.dcinside.com/board/write/*
// @match       https://gall.dcinside.com/mgallery/board/write/*
// @match       https://gall.dcinside.com/mini/board/write/*
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @updateURL   https://openuserjs.org/meta/toriato/DCInside_Account_Randomizer.meta.js
// @supportURL  https://github.com/toriato/userscripts/issues
// @homepageURL https://github.com/toriato/userscripts
// ==/UserScript==

/**
 * 디시인사이드에 로그인을 시도합니다
 * @param {string} username 아이디
 * @param {string} password 비밀번호
 * @param {string} totp TOTP 키
 * @returns {Promise<string>} 세션 아이디
 */
async function login(username, password, totp) {
  fetch({
    anonymous: true,
    url: 'https://dcid.dcinside.com/join/login.php'
  }).catch(console.error)
}
unsafeWindow.login = login

XMLHttpRequest.addFilter(
  (method, url) => method === 'POST' && url === '/board/forms/article_submit',
  function (data) {
    this.preventDefault = true

    fetch({
      method: 'POST',
      url: 'https://gall.dcinside.com/board/forms/article_submit',
      headers: {
        Cookie: 'PHPSESSID=ab58d057f6dfe95ac63389513351d489',
        Referer: location.href,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      data
    })
      .then(({ responseText }) => {
        Object.defineProperty(this, 'responseText', { writable: true })
        this.responseText = responseText
        this.dispatchEvent(new ProgressEvent('load'))
      })
      .catch(err => {
        const e = new ProgressEvent('error')
        this.dispatchEvent(e)
      })
  }
)
