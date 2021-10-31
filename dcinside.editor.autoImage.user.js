// ==UserScript==
// @name        dcinside.editor.autoImage.user.js
// @namespace   https://github.com/toriato/userscripts/dcinside.editor.autoImage.user.js
// @description 디시인사이드 글 작성 페이지를 열 때 사용자가 설정한 이미지(자짤)를 자동으로 업로드합니다
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @match       https://gall.dcinside.com/board/write/*
// @match       https://gall.dcinside.com/mgallery/board/write/*
// @match       https://gall.dcinside.com/mini/board/write/*
// @require     https://unpkg.com/js-sha1@0.6.0/build/sha1.min.js
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// ==/UserScript==

/**
 * 이미지 객체
 * @typedef Image
 * @property {string} name 원래 파일 이름
 * @property {string} hash 이미지 SHA1 해시
 */

/**
 * 갤러리 설정 객체
 * @typedef Option
 * @property {string} id 갤러리 아이디
 * @property {string} name 갤러리 이름
 * @property {Image[]} images 이미지 배열
 * @property {bool} useRandomFilename 무작위 파일 이름을 사용할지?
 * @property {bool} appendRandomBytes 파일 끝에 무작위 바이트를 추가할지?
 */

/**
 * 이미지 구조를 Blob 으로 변환합니다
 * @param {Image} image 
 * @returns {Blob|Error}
 */
function imageToBlob(image) {
  // 이미지 데이터 불러오기
  const encoded = GM_getValue(`image_${image.hash}`)
  if (!encoded) {
    return new Error(`값이 존재하지 않습니다 (image_${image.hash})`)
  }

  // Mime 확인하기
  let type = ''
  switch (image.name.split('.').pop()) {
    case 'jpg':
    case 'jpeg':
      type = 'image/jpeg'
      break
    case 'png':
      type = 'image/png'
      break
    case 'gif':
      type = 'image/gif'
      break
    // case 'webp':
    //   type = 'image/webp'
    //   break
    default:
      return new Error('허용하지 않는 파일입니다')
  }

  const bStr = atob(encoded)
  const bytes = new Uint8Array(bStr.length)
  let bLen = bStr.length

  while (bLen--) {
    bytes[bLen] = bStr.charCodeAt(bLen)
  }

  return new Blob([bytes], { type })
}

/**
 * 자짤을 서버에 업로드한 뒤 편집기에 삽입합니다
 * @returns {Promise<void>}
 */
async function attachPrefixImage() {
  const images = options.images
  if (images.length < 1) {
    return
  }

  // 이미지 디코딩하기
  const image = images[Math.floor(Math.random() * images.length)]

  let blob = imageToBlob(image)
  if (blob instanceof Error) {
    throw blob
  }

  if (options.appendRandomBytes) {
    let shit = new Uint32Array(10)
    crypto.getRandomValues(shit)
    blob = new Blob([blob, shit], { type: blob.type })
  }

  // 폼 데이터 만들기
  const data = new FormData()
  data.append('r_key', document.getElementById('r_key').value)
  data.append('gall_id', options.id)
  data.append('files[]', blob,
    options.useRandomFilename ? `${sha1(new Date)}.${image.name.split('.').pop()}` : image.name)

  // 이미지 업로드
  const res = await new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url: 'https://upimg.dcinside.com/upimg_file.php?id=' + options.id,
      method: 'POST',
      responseType: 'json',
      data,
      onload: resolve,
      onerror: reject,
      onabort: () => reject(new Error('사용자가 작업을 취소했습니다')),
      ontimeout: () => reject(new Error('업로드가 대기 시간이 초과되어 작업이 취소됐습니다'))
    })
  })

  if (res.responseText.includes('Web firewall security policies have been blocked')) {
    throw new Error('웹 방화벽에 의해 차단됐습니다')
  }

  // 편집기에서 이미지 삽입 객체 가져오기
  const attacher = Editor.getSidebar().getAttacher('image', this)

  // 편집기에 이미지 추가하기
  for (let f of res.response.files) {
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

    // 파일 추가하기
    attacher.attachHandler(entry)
  }
}

// 갤러리 별 옵션 불러오기
/** @type {Option} */
const params = (new URL(location.href)).searchParams
const options = GM_getValue(`option_${params.get('id')}`, GM_getValue('option', {}))

if (!options.id) options.id = params.get('id')
if (!options.name) options.name = document.querySelector('title').textContent

attachPrefixImage()
  .catch(e => {
    alert('자짤 업로드 중 오류가 발생했습니다:\n' + e.message)
    console.error(e)
  })

