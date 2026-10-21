import { getStoreProfile } from '@/lib/storeProfile'
import { formatCurrency } from '@/data/mockData'

export type RollSize = '58mm' | '80mm'

export type ReceiptItem = {
  name: string
  quantity: number
  unitPrice: number
}

export type ReceiptData = {
  orderId: string
  date: string
  cashierName: string
  customerName: string
  customerPhone: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  tax: number
  deliveryFee: number
  total: number
  paymentMethod: string
}

const ROLL_WIDTH: Record<RollSize, string> = {
  '58mm': '58mm',
  '80mm': '80mm',
}

const ROLL_FONT: Record<RollSize, string> = {
  '58mm': '10px',
  '80mm': '12px',
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  return str + ' '.repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str
  return ' '.repeat(len - str.length) + str
}

function formatItemLine(item: ReceiptItem, roll: RollSize): string {
  const is58 = roll === '58mm'
  const nameLen = is58 ? 14 : 22
  const qtyLen = is58 ? 3 : 4
  const priceLen = is58 ? 7 : 8
  const amtLen = is58 ? 8 : 9

  const name = item.name.length > nameLen ? item.name.slice(0, nameLen - 1) + '~' : padRight(item.name, nameLen)
  const qty = padLeft(String(item.quantity), qtyLen)
  const rate = padLeft(formatCurrency(item.unitPrice).replace(/[₹\s]/g, ''), priceLen)
  const amt = padLeft(formatCurrency(item.unitPrice * item.quantity).replace(/[₹\s]/g, ''), amtLen)

  return `${name}${qty} ${rate}${amt}`
}

export function buildThermalReceiptHTML(data: ReceiptData, roll: RollSize): string {
  const store = getStoreProfile()
  const width = ROLL_WIDTH[roll]
  const fontSize = ROLL_FONT[roll]
  const now = new Date()
  const dateTime = now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const itemLines = data.items
    .map((item) => formatItemLine(item, roll))
    .map((line) => `        <div class="item-line">${escapeHtml(line)}</div>`)
    .join('\n')

  const optionalRow = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`

  const barcodeDigits = data.orderId.replace(/[^A-Z0-9]/gi, '')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Thermal Receipt ${escapeHtml(data.orderId)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #ffffff;
    color: #000000;
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: ${fontSize};
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .receipt {
    width: ${width};
    margin: 0 auto;
    padding: 4mm 2mm;
  }
  .store-name {
    text-align: center;
    font-size: ${roll === '58mm' ? '14px' : '17px'};
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .store-meta {
    text-align: center;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    line-height: 1.4;
    margin-top: 2px;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    margin: 1px 0;
  }
  .item-header {
    display: flex;
    font-weight: 700;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 2px;
  }
  .item-header span:nth-child(1) { flex: 1; }
  .item-header span:nth-child(2) { width: ${roll === '58mm' ? '24px' : '30px'}; text-align: right; }
  .item-header span:nth-child(3) { width: ${roll === '58mm' ? '50px' : '60px'}; text-align: right; }
  .item-header span:nth-child(4) { width: ${roll === '58mm' ? '55px' : '65px'}; text-align: right; }
  .item-line {
    white-space: pre;
    overflow: hidden;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    margin: 1px 0;
  }
  .totals { margin-top: 4px; }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    margin: 1px 0;
  }
  .row.bold { font-weight: 700; }
  .grand-total {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: ${roll === '58mm' ? '13px' : '16px'};
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 3px 0;
    margin-top: 4px;
  }
  .footer {
    text-align: center;
    font-size: ${roll === '58mm' ? '9px' : '10px'};
    margin-top: 6px;
    line-height: 1.5;
  }
  .barcode {
    text-align: center;
    margin-top: 6px;
    font-family: 'Courier New', monospace;
    font-size: ${roll === '58mm' ? '8px' : '10px'};
    letter-spacing: 2px;
  }
  .barcode-bars {
    display: flex;
    justify-content: center;
    gap: 0;
    height: 32px;
    margin-bottom: 2px;
  }
  .barcode-bars span {
    display: inline-block;
    height: 100%;
    background: #000;
  }
  .powered {
    text-align: center;
    font-size: ${roll === '58mm' ? '8px' : '9px'};
    margin-top: 4px;
  }

  /* ---- Print rules for thermal roll ---- */
  @media print {
    @page {
      size: ${width} auto;
      margin: 0;
    }
    html, body {
      width: ${width};
      margin: 0 !important;
      padding: 0 !important;
    }
    .receipt {
      width: ${width};
      padding: 0;
    }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="store-name">${escapeHtml(store.businessName)}</div>
    <div class="store-meta">
      ${escapeHtml(store.storeAddress)}<br/>
      Tel: ${escapeHtml(store.supportPhone)}<br/>
      ${store.gstin ? `GSTIN: ${escapeHtml(store.gstin)}<br/>` : ''}
    </div>

    <div class="divider"></div>

    <div class="meta-row"><span>Receipt: ${escapeHtml(data.orderId)}</span><span>${escapeHtml(dateTime)}</span></div>
    <div class="meta-row"><span>Cashier: ${escapeHtml(data.cashierName)}</span></div>
    <div class="meta-row"><span>Customer: ${escapeHtml(data.customerName)}</span></div>
    ${data.customerPhone ? `<div class="meta-row"><span>Phone: ${escapeHtml(data.customerPhone)}</span></div>` : ''}

    <div class="divider"></div>

    <div class="item-header">
      <span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span>
    </div>
    ${itemLines}

    <div class="divider"></div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(data.subtotal))}</span></div>
      ${data.discount > 0 ? optionalRow('Discount', `-${formatCurrency(data.discount)}`) : ''}
      ${data.tax > 0 ? optionalRow('CGST/SGST', formatCurrency(data.tax)) : ''}
      ${data.deliveryFee > 0 ? optionalRow('Delivery Fee', formatCurrency(data.deliveryFee)) : ''}
      <div class="grand-total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(data.total))}</span></div>
      <div class="row"><span>Paid via</span><span>${escapeHtml(data.paymentMethod)}</span></div>
    </div>

    <div class="footer">
      Thank You for Shopping with Us!<br/>
      Visit Again — Zubkas StorePulse
    </div>

    <div class="barcode">
      <div class="barcode-bars">${buildBarcodeSpans(barcodeDigits)}</div>
      ${escapeHtml(barcodeDigits)}
    </div>

    <div class="powered">Powered by Zubkas Technology</div>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildBarcodeSpans(code: string): string {
  let spans = ''
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i)
    for (let b = 0; b < 4; b++) {
      const isBar = ((charCode >> b) & 1) === 1
      const w = ((charCode >> (b + 2)) & 1) ? 3 : 1
      if (isBar) {
        spans += `<span style="width:${w}px"></span>`
      } else {
        spans += `<span style="width:${w}px;background:transparent"></span>`
      }
    }
  }
  return spans
}

export function printThermalReceipt(data: ReceiptData, roll: RollSize): void {
  const html = buildThermalReceiptHTML(data, roll)
  const win = window.open('', '_blank', `width=${roll === '58mm' ? 260 : 360},height=600`)
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  window.setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}
