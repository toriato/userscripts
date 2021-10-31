// ==UserScript==
// @name          디시인사이드 이지 디시콘
// @namespace     https://github.com/toriato/userscripts/dcinside.macro.dcon.user.js
// @match         https://gall.dcinside.com/board/view/*
// @match         https://gall.dcinside.com/mgallery/board/view/*
// @match         https://gall.dcinside.com/mini/board/view/*
// @require       https://unpkg.com/js-sha1@0.6.0/build/sha1.min.js
// @run-at        document-end
// @noframes
// @grant         GM_xmlhttpRequest
// ==/UserScript==

const codes = {
  Numpad1: [
    // 한심콘
    [30073, 497697002],
    [30073, 497697003],
    [30073, 497697004],
    [30073, 497697005]
  ],
  // 기묘한 애옹스
  Numpad2: [
    [46604, 499376600],
    [46604, 499376601],
    [46604, 499376602],
    [46604, 499376603],
    [46604, 499376604],
    [46604, 499376605],
    [46604, 499376606],
    [46604, 499376607],
    [46604, 499376608],
    [46604, 499376609],
    [46604, 499376610],
    [46604, 499376611],
    [46604, 499376612],
    [46604, 499376613],
    [46604, 499376614],
    [46604, 499376615],
    [46604, 499376616],
    [46604, 499376617],
    [46604, 499376588],
    [46604, 499376589],
    [46604, 499376590],
    [46604, 499376591],
    [46604, 499376592],
    [46604, 499376593],
    [46604, 499376594],
    [46604, 499376595],
    [46604, 499376596],
    [46604, 499376597],
    [46604, 499376598],
    [46604, 499376599],
  ]
}

const params = new URL(location.href).searchParams
const list = () => { location.href = `https://gall.dcinside.com/mgallery/board/lists?id=` + params.get('id') }
const gen = s => [...Array(s)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

window.addEventListener('keypress', e => {
  if (e.code === 'Numpad0') list()
  if (!(e.code in codes)) return

  const icon = codes[e.code][codes[e.code].length * Math.random() | 0]
  const payload = {
    id: params.get('id'),
    no: params.get('no'),
    package_idx: icon[0],
    detail_idx: icon[1],
    input_type: 'comment',
    check_6: gen(10),
    check_7: gen(10),
    check_8: gen(10)
  }

  GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://gall.dcinside.com/dccon/insert_icon',
    headers: {
      Referer: 'https://gall.dcinside.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: Object.entries(payload).map(([k, v]) => k + '=' + v).join('&'),
    onload: r => r.responseText === 'ok' ? list() : alert(r.responseText)
  })
})
