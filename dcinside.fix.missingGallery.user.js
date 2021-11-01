// ==UserScript==
// @name        dcinside.fix.missingGallery.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.fix.missingGallery.user.js
// @description 디시인사이드에서 '해당 갤러리는 존재하지 않습니다' 메세지가 발생하면 자동으로 페이지를 새로 고칩니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/*
// @match       https://m.dcinside.com/board/*
// @run-at      document-start
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.fix.missingGallery.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

// TODO: 진짜 없는 갤러리인지 확인 필요 -> 연속 새로고침 제한?
if (document.documentElement.outerHTML.includes('alert("해당 갤러리는 존재하지 않습니다.")')) {
  location.reload()
}
