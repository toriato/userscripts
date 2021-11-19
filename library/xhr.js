// ==UserScript==
// @exclude     *
// @grant       GM.xmlhttpRequest
// ==UserLibrary==
// @name        XHR Hooks
// @description XHR 요청을 가로채 사용자 콜백을 실행합니다
// @version     1.0.0
// @author      toriato
// @copyright   2021, Sangha Lee
// @license     MIT
// @homepageURL https://github.com/toriato/userscripts
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserLibrary==
// ==/UserScript==

XMLHttpRequest.hooks = []
XMLHttpRequest.registerHook = function (filter, callback) {
  this.hooks.push({ filter, callback })
}

XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function () {
  this.hooks = []
  this.preventDefault = false

  for (let hook of XMLHttpRequest.hooks) {
    if (hook.filter.call(this, ...arguments)) {
      this.hooks.push(hook)
    }
  }

  this._open(...arguments)
}

XMLHttpRequest.prototype.send = function (data) {
  for (let { callback } of this.hooks) {
    data = callback.call(this, data)
  }

  if (!this.preventDefault) {
    this._send(data)
  }
}
