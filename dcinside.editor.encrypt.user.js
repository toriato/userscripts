// ==UserScript==
// @name          디시인사이드 편집기 암호화 / 복호화 도구
// @namespace     https://github.com/toriato/userscripts/dcinside.editor.encrypt.user.js
// @match         https://gall.dcinside.com/board/write/*
// @match         https://gall.dcinside.com/board/view/*
// @match         https://gall.dcinside.com/mgallery/board/write/*
// @match         https://gall.dcinside.com/mgallery/board/view/*
// @match         https://gall.dcinside.com/mini/board/write/*
// @match         https://gall.dcinside.com/mini/board/view/*
// @require       https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js
// @run-at        document-end
// @noframes
// @version 1
// ==/UserScript==

if ('Editor' in window) {
  XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url) {
    if (url === '/board/forms/article_submit') {
      this._hooked = true
    }

    this._open(...arguments)
  }

  XMLHttpRequest.prototype.send = function (data) {
    if (this._hooked) {
      const passphrase = prompt('비밀번호를 입력해주세요')

      const params = new URLSearchParams(data)
      const content = params.get('memo')
      const payload = [
        '1', // version
        'AES', // type
        CryptoJS.SHA1(content).toString(), // sha1 hash of original content
        CryptoJS.AES.encrypt(content, passphrase).toString() // encrypted text
      ]

      params.set('memo', payload.join(':'))

      data = params.toString()
    }

    this._send(data)
  }
} else {
  const $content = document.querySelector('.write_div')
  const payload = $content.textContent.trim().split(':')

  if (payload[1] === 'AES') {
    const passphrase = prompt('비밀번호를 입력해주세요')

    try {
      $content.innerHTML = CryptoJS.AES.decrypt(payload[3], passphrase).toString(CryptoJS.enc.Utf8)
    } catch (e) {
      alert('비밀번호가 잘못됐습니다')
      console.error(e)
    }
  }
}
