// ==UserScript==
// @name        디시인사이드 이미지 원본 교체
// @namespace   https://github.com/toriato/userscripts/dcinside.view.fixImageSource.user
// @match       https://gall.dcinside.com/*
// @grant       GM_xmlhttpRequest
// @noframes
// ==/UserScript==

const r = d => new Promise((resolve, reject) => {
  d.onload = resolve
  d.onerror = reject
  GM_xmlhttpRequest(d)
})

for (let img of document.querySelectorAll('.write_div img[alt]')) {
  console.log('https://image.dcinside.com/' + img.alt)
  r({ method: 'GET', url: 'https://image.dcinside.com/viewimagePop.php' + img.alt.replace('viewimage.php', '') })
    .then(r => {
      img.src = r.responseText.split('src="', 2)[1].split('"', 2)[0]
    })
}