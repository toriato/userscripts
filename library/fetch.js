// ==UserScript==
// @exclude     *
// @grant       GM.xmlhttpRequest
// ==UserLibrary==
// @name        Fetch
// @description 비동기(Promise) 웹 요청 라이브러리
// @version     1.0.0
// @author      toriato
// @copyright   2021, Sangha Lee
// @license     MIT
// @homepageURL https://github.com/toriato/userscripts
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserLibrary==
// ==/UserScript==

/**
 * 비동기로 웹 요청을 실행합니다
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function fetch(options) {
  return new Promise((resolve, reject) => {
    if (!('method' in options))
      options.method = 'GET'

    options.onabort = () => reject('사용자가 작업을 취소했습니다')
    options.ontimeout = () => reject('작업 시간이 초과됐습니다')
    options.onerror = reject
    options.onload = resolve
    GM_xmlhttpRequest(options)
  })
}
