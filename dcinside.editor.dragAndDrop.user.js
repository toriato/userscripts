// ==UserScript==
// @name        dcinside.editor.dragAndDrop.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.editor.dragAndDrop.user.js
// @description 디시인사이드 글 작성 편집기에 드래그 앤 드랍으로 파일을 올릴 수 있는 기능을 추가합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/board/write/*
// @match       https://gall.dcinside.com/mgallery/board/write/*
// @match       https://gall.dcinside.com/mini/board/write/*
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @downloadURL https://github.com/toriato/userscripts/raw/master/dcinside.editor.dragAndDrop.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// ==/UserScript==

const allowedMIMEs = /image\/(webp|png|jpeg|gif|bmp)/

const page = {
  params: (new URL(location.href)).searchParams,
  editor: {}
}

page.editor.$canvas = document.querySelector('#tx_canvas_wysiwyg')
page.editor.$container = page.editor.$canvas.contentDocument.querySelector('.tx-content-container')

function request(details) {
  return new Promise((resolve, reject) => {
    details.method = details.method ? details.method : 'GET'
    details.onload = resolve
    details.onerror = reject
    details.onabort = () => reject(new Error('사용자가 작업을 취소했습니다'))
    details.ontimeout = () => reject(new Error('요청 시간이 초과됐습니다'))
    GM_xmlhttpRequest(details)
  })
}

async function uploadImage(file) {
  const gallery = page.params.get('id')
  const data = new FormData()

  // 글 작성 키 값 중 뒤 다섯 글자만 무작위로 바꿔 이미지 제한 방해하기
  const key = document.getElementById('r_key').value.slice(0, -5) + ('' + Math.random()).slice(2, 7)

  data.append('r_key', key)
  data.append('gall_id', gallery)
  data.append('files[]', file, file.name)

  const res = await request({
    url: 'https://upimg.dcinside.com/upimg_file.php?id=' + gallery,
    method: 'POST',
    responseType: 'json',
    data
  })

  // 업로드 불가능한 파일을 올렸을 때 발생하는 보안 오류 (exe, msi 등)
  if (res.responseText.includes('Web firewall security policies have been blocked')) {
    throw new Error('웹 방화벽에 의해 차단됐습니다')
  }

  return res.response.files[0]
}

page.editor.$container.addEventListener('drop', e => {
  let prevent = false

  const promises = []

  // 드롭된 컨텐츠 중 파일만 가져오기
  for (let item of e.dataTransfer.items) {
    // 파일로 불러올 수 없다면 무시하기
    const file = item.getAsFile()
    if (!file) {
      continue
    }

    // 지원하지 않는 파일 종류라면 무시하기
    if (!file.type.match(allowedMIMEs)) {
      continue
    }

    promises.push(uploadImage(file))

    prevent = true
  }

  Promise.all(promises)
    .then(files => {
      const attacher = Editor.getSidebar().getAttacher('image', this)

      // 편집기에 업로드한 이미지 순서대로 추가하기
      for (f of files) {
        // https://github.com/kakao/DaumEditor/blob/e47ecbea89f98e0ca6e8b2d9eeff4c590007b4eb/daumeditor/js/trex/attacher/image.js
        const entry = {
          filename: f.name,
          filesize: f.size,
          imagealign: 'L',
          imageurl: f.url,
          originalurl: f.url,
          thumburl: f._s_url,
          file_temp_no: f.file_temp_no,
          mp4: f.mp4
        }

        if (f.web__url) {
          entry.imageurl = f.web__url
        } else if (f.web2__url) {
          entry.imageurl = f.web2__url
        }

        attacher.attachHandler(entry)
      }
    })
    .catch(e => {
      console.error(e)
    })

  if (prevent) {
    e.preventDefault()
  }
})
