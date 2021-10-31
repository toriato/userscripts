// ==UserScript==
// @name        점포경영시스템+
// @namespace   https://github.com/toriato/userscript/gsmp.user.js
// @description GS25 점포경영시스템에 편리 기능을 추가합니다
// @icon        http://hcvsscn.gsretail.com/install/img/gs25.ico
// @match       http://hcvsscn.gsretail.com/cssc/index.html
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// ==/UserScript==

const DAY = 24 * 60 * 60 * 1000

class GSMP {
  static DEBUG = false

  /** @type IDBDatabase */
  static DB

  static SHORTCUTS = {
    // 중분류 발주
    grd_scrOrdLine: {
      Enter: function (e) {
        if (!e.shiftKey && !e.ctrlKey) return

        const parent = this.parent

        // 발주 값이 수정됐다면 저장하기
        if (!parent.gfn_IsUpdateDataset(parent.dsArray)) {
          parent.fn_SaveOrdStrLine()
        }

        if (e.shiftKey) parent.fn_OrdClassMvRight() // 다음 소분류
        if (e.ctrlKey) parent.fn_OrdClassMvLeft() // 이전 소분류
      }
    },
  }

  static getFocus() {
    return application.mainframe.getActiveFrame().getActiveFrame().getForm().getFocus()
  }

  static fetch(d) {
    return new Promise((resolve, reject) => {
      d.onabort = () => reject('사용자가 작업을 취소했습니다')
      d.ontimeout = () => reject('작업 시간이 초과됐습니다')
      d.onerror = reject
      d.onload = r => {
        // 전송한 데이터가 SSV 라면 받은 데이터 디코딩하기
        if (typeof d.data === 'string' && d.data.startsWith('SSV')) {
          r.datasets = SSV.decode(r.responseText)
        }

        resolve(r)
      }
      GM_xmlhttpRequest(d)
    })
  }

  static login(id) {
    const f = application.mainframe.FrameSet0.ChildFrame0.form
    f.ds_login.clearData()
    f.ds_login.addRow()
    f.ds_login.setColumn(0, 'USER_ID', id)
    f.gfn_CallService(
      'SVC_Login',
      'cssc/portal/portal/Login.do',
      'ds_login=ds_login',
      'ds_user=ds_user ds_todoRole=ds_todoRole',
      '')
  }

  static openDetailsDialog(code) {
    const form = application.mainframe.getActiveFrame().getActiveFrame().getForm()

    form.gfn_Dialog('mst::SMSGO02_GoodsMstDetailM.xfdl')

    // 생성된 다이어로그에 이벤트 추가하기
    const frames = form.parent._frames
    const dialog = frames[frames.length - 1]

    dialog.addEventHandler('onactivate', () => {
      const form = dialog.getForm()
      form.ed_goodsCd.value = code
      form.fn_SearchGoods()
    })

    dialog.addEventHandler('onkeydown', (dialog, e) => {
      if (e.keycode === 27) {
        dialog._closeForm()
      }
    })
  }

  static openSummaryDialog(code, date) {
    const form = application.mainframe.getActiveFrame().getActiveFrame().getForm()

    if (!date) {
      const d = new Date()

      date = [
        d.getFullYear(),
        ('' + (d.getMonth() + 1)).padStart(2, '0'),
        ('' + (d.getDate())).padStart(2, '0')
      ].join('')
    }

    form.gfn_Dialog(
      'ord::SORGN01_OrdGoodsMngP.xfdl',
      `goodsCd=${code} ordDt=${date}`)

    // 생성된 다이어로그에 이벤트 추가하기
    const frames = form.parent._frames
    const dialog = frames[frames.length - 1]

    dialog.addEventHandler('onkeydown',
      (dialog, e) => {
        const form = dialog.getForm()
        const dataset = form.ds_outOrDGood

        if (e.keycode === 27) {
          dataset.setColumn(0, "SHELF_INFO", dataset.getOrgColumn(0, "SHELF_INFO"))
          if (form.isUpdatedCheck()) form.fn_Save()
          form.fn_Close()
        }
      })
  }
}

class Product {
  /** @type {string} */
  code

  /** @type {string} */
  name

  /** @type {string} */
  image

  /**
   * 제품의 이름, 이미지 등 제품 정보를 업데이트합니다
   */
  async fetch() {
    const { datasets } = await GSMP.fetch({
      method: 'POST',
      url: 'http://hcvsscn.gsretail.com/cssc/mst/goods/RetrieveGoodsMstDetail.do',
      data: SSV.encode([{
        id: 'ds_inGoodsmstdtlRetrieveGoodsMstDetailBR',
        columns: [
          { name: 'GOODS_CD' },
          { name: 'GOODS_REGION_CD' },
          { name: 'ORIGIN_BIZPL_CD' },
          { name: 'BIZPL_CD' },
          { name: 'ORD_SP' },
          { name: 'BIZPL_DSTRB_DT' },
          { name: 'RTN_DT' }
        ],
        rows: [{ GOODS_CD: this.code }]
      }])
    })

    /** @type {Dataset} */
    const ds = datasets.OUT_GOODSMSTDTL
    if (ds.rows.length < 1) {
      throw new Error(`${this.code} 제품은 존재하지 않습니다`)
    }

    const r = ds.rows[0]

    this.name = r.GOODS_NM
    this.image = r.IMAGE_FILE_NM

    const tx = GSMP.DB.transaction('products', 'readwrite')
    const store = tx.objectStore('products')
    const index = store.index('code')

    await new Promise((resolve, reject) => {
      const r = index.openCursor(IDBKeyRange.only(this.code))
      r.onsuccess = e => resolve(e.target.result)
      r.onerror = e => reject(e.target.error)
    }).then(c =>
      new Promise((resolve, reject) => {
        const r = c ? c.update(this) : store.add(this)
        r.onsuccess = e => resolve(e.target.result)
        r.onerror = e => reject(e.target.error)
      }))
  }

  /**
   * 제품의 특정 날짜 입고, 판매, 증정, 반품, 폐기 수량을 업데이트합니다
   * @param {Date} since
   * @param {number} days
   */
  async fetchStats(since, days) {
    const users = application.mainframe.FrameSet0.ChildFrame0.form.ds_user
    const bizOriginCode = users.getColumn(0, 3)
    const bizCode = users.getColumn(0, 5)
    const product = await this.updateProduct(this.code)

    // 일자까지만 가져오기
    let current = since.getTime()
    current -= current % DAY
    current += since.getTimezoneOffset() * 60 * 1000

    const until = current - (days * DAY)
    const untilPadded = until - (14 * DAY)

    let promises = []

    /** @type {Dataset[]} */
    const datasets = [
      {
        id: 'ds_inWeatherStk',
        columns: [
          { name: 'ORIGIN_BIZPL_CD' },
          { name: 'BIZPL_CD' },
          { name: 'ORD_DT' },
          { name: 'GOODS_CD' },
          { name: 'GOODS_CD_OLD' },
          { name: 'LINE_CD' }
        ]
      }
    ]

    while (current >= untilPadded) {
      const date = new Date(current)
      const timestamp = date.getTime()
      const dateFormat = [
        date.getFullYear(),
        (1 + date.getMonth() + '').padStart(2, 0),
        (date.getDate() + '').padStart(2, 0)
      ].join('')

      const ds = datasets

      ds[0].rows = [{
        ORIGIN_BIZPL_CD: bizOriginCode,
        BIZPL_CD: bizCode,
        ORD_DT: dateFormat,
        GOODS_CD: code
      }]

      promises.push(
        GSMP.fetch({
          method: 'POST',
          url: 'http://hcvsscn.gsretail.com/cssc/ord/gnrlord/RetrieveOrdGoodsStk.do',
          data: SSV.encode(ds)
        }).then(({ datasets }) => {
          const stats = Array(14)

          for (let i = 0; i < 14; i++) {
            stats[i] = {
              product: product.key,
              date: timestamp - (12 - i) * DAY
            }
          }

          for (let row of datasets.ds_outStk.rows) {
            for (let i = 0; i < 14; i++) {
              stats[i][row.COL_ID] = parseInt(row[i + 3], 10)
            }
          }

          return stats
        })
      )

      current -= 14 * DAY
    }

    const stats = (await Promise.all(promises))
      .flat()
      .filter(v => v.sale || v.discard || v.stkin || v.present || v.return)
      .sort((a, b) => b.date - a.date)

    const tx = GSMP.DB.transaction('product_stats', 'readwrite')
    const store = tx.objectStore('product_stats')
    const index = store.index('product, date')

    return await Promise.all(stats.map(stat =>
      new Promise((resolve, reject) => {
        const r = index.openCursor(IDBKeyRange.only([stat.product, stat.date]))
        r.onsuccess = e => resolve(e.target.result)
        r.onerror = e => reject(e.target.error)
      })
        .then(c =>
          new Promise((resolve, reject) => {
            const r = c ? c.update(stat) : store.add(stat)
            r.onsuccess = e => resolve(e.target.result)
            r.onerror = e => reject(e.target.error)
          }))
        .then(key => Object({ key, ...stat }))
    ))
  }

  async stats(days) {
    const r = {
      stats: await this.fetchStats(this.code, new Date, days),
      total: {
        in: 0,
        out: 0,
        present: 0,
        return: 0,
        discard: 0
      }
    }

    for (let stat of r.stats) {
      if (stat.stkin) r.total.in += stat.stkin
      if (stat.sale) r.total.out += stat.sale
      if (stat.discard) r.total.discard += stat.discard
      if (stat.present) {
        r.total.out += stat.present
        r.total.present += stat.present
      }
      if (stat.return) {
        r.total.out -= stat.return
        r.total.return += stat.return
      }
    }

    return r
  }
}

class ProductFactory {
  /**
   * @param {string} code 
   */
  static async get(code) {
    const data = await new Promise((resolve, reject) => {
      const tx = GSMP.DB.transaction('products', 'readwrite')
      const store = tx.objectStore('products')
      const index = store.index('code')
      const r = index.openCursor(IDBKeyRange.only(code))
      r.onerror = e => reject(e.target.error)
      r.onsuccess = e => resolve(e.target.result)
    })

    const product = new Product()

    if (data) {
      for (let key of Object.keys(product)) {
        product[key] = data.value[key]
      }
    } else {
      product.code = code
      await product.fetch()
    }

    return product
  }
}

class SSV {
  static recordSeparator = String.fromCharCode(0x1E)
  static unitSeparator = String.fromCharCode(0x1F)
  static eot = String.fromCharCode(0x03)

  /**
 * @typedef Dataset
 * @type {Object}
 * @property {string} id
 * @property {DatasetColumn[]} columns
 * @property {Object[]} rows
 */

  /**
   * @typedef DatasetColumn
   * @type {Object}
   * @property {string} name
   * @property {string} type
   */

  /**
   * SSV 포맷으로 인코딩된 문자열을 디코딩합니다
   * @param {string} raw 
   * @returns {Dataset[]}
   */
  static decode(raw) {
    const records = raw.split(this.recordSeparator)

    /** @type {Dataset[]} */
    const datasets = {}

    /** @type {string} */
    let cursor = null

    for (let i = 0, len = records.length; i < len; i++) {
      const units = records[i].split(this.unitSeparator)

      // Stream Header
      if (i == 0) {
        continue
      }

      switch (true) {
        case units[0] == '':
          // Reset
          break

        case units[0].startsWith('Dataset:'):
          cursor = units[0].slice(8)

          datasets[cursor] = {
            columns: [],
            rows: []
          }

          break

        case units[0].startsWith('_Const_'):
          // TODO: Column Const
          break

        case units[0].startsWith('_RowType_'):
          // Colum Infos
          for (let j = 1; j < units.length; j++) {
            const attrs = units[j].split(':')
            const column = {
              name: attrs[0],
              type: 'string'
            }

            // TODO: Parse type

            datasets[cursor].columns.push(column)
          }
          break

        default:
          // Variables
          if (cursor == null) {
            continue
          }

          // Record
          const row = []

          for (let j = 1; j < units.length; j++) {
            const index = j - 1
            const column = datasets[cursor].columns[index]

            // TODO: Type casting
            let v = units[j]
            if (v === this.eot) {
              v = ''
            }

            row[index] = v
            row[column.name] = v
          }

          datasets[cursor].rows.push(row)
      }
    }

    return datasets
  }

  /**
   * 데이터셋을 SSV 포맷으로 인코딩합니다
   * @param {Dataset[]} datasets 
   * @returns {string}
   */
  static encode(datasets) {
    const ssv = ['SSV:UTF-8']

    for (let dataset of datasets) {
      ssv.push(`Dataset:${dataset.id}`)
      ssv.push([
        '_RowType_',
        ...dataset.columns.map(c => `${c.name}:${c.type ? c.type : 'STRING'}`)
      ].join(this.unitSeparator))

      for (let row of dataset.rows) {
        const units = ['N']

        for (let column of dataset.columns) {
          if (column.name in row) {
            units.push(row[column.name])
          } else {
            units.push(this.eot)
          }
        }

        ssv.push(units.join(this.unitSeparator))
      }
    }

    return ssv.join(this.recordSeparator)
  }
}

document.addEventListener('keypress', e => {
  const f = GSMP.getFocus()

  console.log(f.id)

  if (f.id in GSMP.SHORTCUTS && e.key in GSMP.SHORTCUTS[f.id]) {
    GSMP.SHORTCUTS[f.id][e.key].call(f, e)
    return
  }

  // 상품 발주조회 다이얼로그 열기
  if (f instanceof nexacro.Grid && e.key === '`') {
    const code = f.getBindDataset().getColumn(f.currentrow, 'GOODS_CD')
    if (code) {
      GSMP.openSummaryDialog(code)
    }
  }
})

application.addEventHandler('onloadforms', () => {
  new Promise((resolve, reject) => {
    const idb = indexedDB.open('gsmp', 1)
    idb.onerror = e => reject(e.target)
    idb.onsuccess = () => resolve(idb.result)
    idb.onupgradeneeded = e => {
      /** @type {IDBDatabase} */
      const db = e.target.result

      /** @type {IDBObjectStore} */
      let store

      store = db.createObjectStore('products', { autoIncrement: true })
      store.createIndex('code', 'code', { unique: true })
      store = db.createObjectStore('product_stats', { autoIncrement: true })
      store.createIndex('product, date', ['product', 'date'], { unique: true })
    }
  })
    .then(db => { GSMP.DB = db })
    .then(() => {
      // 자동 로그인
      if (GM_getValue('autologin'))
        GSMP.login(GM_getValue('autologin'))

      const trace = unsafeWindow.trace
      unsafeWindow.trace = () => {
        if (GSMP.DEBUG) {
          trace(...arguments)
        }
      }
    })
    .catch(err => {
      alert('GSMP 초기화에 실패했습니다!\n자세한 오류는 콘솔을 확인해주세요')
      console.error(err)
    })
})

unsafeWindow.GSMP = GSMP
unsafeWindow.Product = Product
unsafeWindow.ProductFactory = ProductFactory
unsafeWindow.SSV = SSV
