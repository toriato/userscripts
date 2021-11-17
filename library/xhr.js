// ==UserScript==
// ==UserLibrary==
// @name        xhr.js
// @description XHR 요청을 가로채 사용자 콜백을 실행합니다
// ==/UserLibrary==
// @namespace   https://github.com/toriato/userscripts/library/xhr.js
// @exclude     *
// @downloadURL https://github.com/toriato/userscripts/raw/master/library/xhr.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserLibrary==
// ==/UserScript==

XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.callback = null

XMLHttpRequest.filters = []
XMLHttpRequest.addFilter = function (filter, callback) {
  this.filters.push({ filter, callback })
}

XMLHttpRequest.prototype.open = function () {
  for (let { filter, callback } of this.filters) {
    if (filter.call(this, ...arguments)) {
      this.callback = callback
    }
  }

  this._open(...arguments)
}

XMLHttpRequest.prototype.send = function (data) {
  if (this.callback) {
    if (!this.callback(data)) {
      return
    }
  }

  this._send(data)
}
