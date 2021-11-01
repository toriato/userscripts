// ==UserScript==
// @name        dcinside.fix.missingImage.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.fix.missingImage.user.js
// @description 디시인사이드에서 간혈적으로 이미지가 보이지 않는 오류를 원본 이미지로 주소를 교체해 해결합니다
// @author      Sangha Lee <totoriato@gmail.com>
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @require     https://github.com/toriato/userscripts/raw/master/library/fetch.js
// @match       https://gall.dcinside.com/*
// @grant       GM_xmlhttpRequest
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.fix.missingImage.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==


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
