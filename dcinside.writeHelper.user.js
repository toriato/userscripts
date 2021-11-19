// ==UserScript==
// @name        DCInside Write Helper
// @description 디시인사이드에 글을 작성할 때 자동으로 자짤, 말머리, 말꼬리 등을 추가합니다
// @version     1.0.0
// @author      toriato
// @copyright   2021, Sangha Lee
// @license     MIT
// @icon        https://nstatic.dcinside.com/dc/m/img/dcinside_icon.png
// @require     https://unpkg.com/js-sha1@0.6.0/build/sha1.min.js
// @require     https://openuserjs.org/src/libs/toriato/Promisified_GM_xmlhttpRequest.min.js
// @require     https://openuserjs.org/src/libs/toriato/XHR_Hooks.min.js
// @match       https://gall.dcinside.com/board/write/*
// @match       https://gall.dcinside.com/mgallery/board/write/*
// @match       https://gall.dcinside.com/mini/board/write/*
// @run-at      document-end
// @grant       GM_getValue
// @grant       GM_xmlhttpRequest
// @updateURL   https://openuserjs.org/meta/toriato/DCInside_Write_Helper.user.js
// @supportURL  https://github.com/toriato/userscripts/issues
// @homepageURL https://github.com/toriato/userscripts
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
 * @property {string[]} headers 글머리 배열
 * @property {string[]} footers 글꼬리 배열
 * @property {Image[]} images 이미지 배열
 * @property {bool} useRandomFilename 무작위 파일 이름을 사용할지?
 * @property {bool} appendRandomBytes 파일 끝에 무작위 바이트를 추가할지?
 */


// 갤러리 별 옵션 불러오기
const params = (new URL(location.href)).searchParams
const galleryId = params.get('id')

/** @type {Option} */
const options = GM_getValue(`option_${galleryId}`, GM_getValue('option', {}))

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
async function attachImage() {
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
  data.append('gall_id', galleryId)
  data.append('files[]', blob,
    options.useRandomFilename ? `${sha1(new Date)}.${image.name.split('.').pop()}` : image.name)

  // 이미지 업로드
  const res = await fetch({
    url: 'https://upimg.dcinside.com/upimg_file.php?id=' + galleryId,
    method: 'POST',
    responseType: 'json',
    data,
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

// 말머리와 말꼬리 추가를 위해 훅 추가하기
XMLHttpRequest.registerHook(
  (method, url) => method === 'POST' && url === '/board/forms/article_submit',
  function (data) {
    const params = new URLSearchParams(data)
    const contents = [params.get('memo')]

    if (options.headers && options.headers.length > 0) {
      const header = options.headers[Math.floor(Math.random() * options.headers.length)]
      contents.unshift(`<div id="dcappheader">${header}</div>`)
    }

    if (options.footers && options.footers.length > 0) {
      const footer = options.footers[Math.floor(Math.random() * options.footers.length)]
      contents.push(`<div id="dcappheader">${footer}</div>`)
    }

    params.set('memo', contents.join(''))

    return params.toString()
  }
)

// 자짤 올리기
attachImage()
  .catch(e => {
    alert('자짤 업로드 중 오류가 발생했습니다:\n' + e.message)
    console.error(e)
  })

