// ==UserScript==
// @name        POG
// @namespace   https://github.com/toriato/userscripts/pog.user.js
// @match       *://*/*
// @run-at      document-start
// @grant       GM_addStyle
// ==/UserScript==

GM_addStyle('img.pogged { display: inline; vertical-align: text-bottom; height: 1.5em }')

new MutationObserver(records => {

  for (let record of records) {
    if (record.target.classList.contains('pogged')) {
      continue
    }

    for (let node of record.addedNodes) {
      if (!node.parentElement || node.nodeType !== 3) {
        continue
      }

      let pogged = false
      let poggedChat = node.data.split(/\s/)
        .map(word => {
          if (word === 'xqcL') {
            pogged = true
            return '<img class="pogged" src="https://static-cdn.jtvnw.net/emoticons/v2/1035663/static/light/2.0">'
          }

          return word
        })
        .join(' ')

      if (pogged) {
        node.parentElement.innerHTML = poggedChat
      }

    }
  }

}).observe(
  document.documentElement,
  {
    childList: true,
    subtree: true
  }
)
