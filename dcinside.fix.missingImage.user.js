// ==UserScript==
// @name        dcinside.fix.missingImage.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.fix.missingImage.user.js
// @description 디시인사이드에서 간혈적으로 이미지가 보이지 않는 오류를 원본 이미지로 주소를 교체해 해결합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/*
// @grant       GM_xmlhttpRequest
// ==/UserScript==

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

for (let element of document.querySelectorAll('[onClick]')) {
  const matches = element.getAttribute('onClick').match(/javascript:imgPop\('([^']+)/)
  if (!matches) {
    continue
  }

  fetch({
    method: 'GET',
    url: matches[1]
  }).then(({ responseText }) => {
    element.src = responseText.split('src="', 2)[1].split('"', 2)[0]
  })
}
