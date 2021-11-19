// ==UserScript==
// @name        디시인사이드 오류 해결 도우미
// @description 디시인사이드에서 자주 발생하는 오류를 해결합니다
// @version     1.0.0
// @author      toriato
// @copyright   2021, Sangha Lee
// @license     MIT
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/*
// @match       https://m.dcinside.com/board/*
// @run-at      document-start
// @updateURL   https://openuserjs.org/meta/toriato/dcinside.fix.user.js
// @downloadURL https://openuserjs.org/install/toriato/dcinside.fix.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

// 존재하는 갤러리임에도 불구하고 '해당 갤러리가 존재하지 않습니다' 오류 메세지 발생 시
// 페이지 새로 고치기
if (document.documentElement.outerHTML.includes('alert("해당 갤러리는 존재하지 않습니다.")')) {
  // TODO: 무한 새로고침 발생, 실제로 없는 갤러리인지 확인 필요
  location.reload()
}

// 간혈적으로 이미지가 보이지 않는 오류
// 기존 섬네일 이미지를 원본 경로로 변경하기
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
