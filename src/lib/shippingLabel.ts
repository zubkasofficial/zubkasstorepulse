import type { Order } from '@/data/mockData'
import { formatCurrency } from '@/data/mockData'
import type { ShippingInfo } from '@/lib/shipping'

const SENDER = {
  name: 'Zubkas StorePulse',
  company: 'Zubkas Technology Private Limited',
  address: 'Zubkas Tower, Tech Park, Bengaluru, Karnataka 560001',
  phone: '+91 80 4567 8900',
  email: 'support@zubkas.com',
}

function buildBarcodeSvg(value: string): string {
  // Simple Code39-style visual barcode (decorative — not a scannable standard, but a clear visual marker)
  const bars: string[] = []
  let x = 0
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    for (let b = 0; b < 4; b++) {
      const w = ((code >> b) & 1) ? 3 : 1
      const isBar = b % 2 === 0
      if (isBar) {
        bars.push(`<rect x="${x}" y="0" width="${w}" height="60" fill="#0f172a" />`)
      }
      x += w + 1
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="60" viewBox="0 0 ${x} 60">${bars.join('')}</svg>`
}

export function buildShippingLabelHTML(order: Order, info: ShippingInfo): string {
  const isCod = order.payment === 'Pending' || order.paymentMethod.toLowerCase().includes('cod')
  const paymentLabel = isCod ? 'COD' : 'Prepaid'
  const paymentAmount = isCod ? formatCurrency(order.total) : formatCurrency(order.total)
  const barcodeSvg = buildBarcodeSvg(order.id.replace(/[^A-Z0-9]/gi, ''))

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Shipping Label ${order.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; background: #e2e8f0; padding: 20px; }
  .label { width: 4in; min-height: 6in; margin: 0 auto; background: #fff; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
  .brand-bar { background: #9f0f0f; color: #fff; padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .brand-bar .brand { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
  .brand-bar .payment { font-size: 11px; font-weight: 600; background: #fff; color: #9f0f0f; padding: 3px 8px; border-radius: 4px; }
  .section { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9f0f0f; margin-bottom: 6px; }
  .from-to { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .from-to .section { margin-bottom: 0; }
  .addr-name { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .addr-line { font-size: 11px; color: #475569; line-height: 1.45; }
  .addr-pin { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  .phone { font-size: 11px; color: #475569; margin-top: 4px; }
  .courier-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .courier-name { font-size: 12px; font-weight: 700; color: #0f172a; }
  .courier-awb { font-size: 11px; font-family: monospace; color: #475569; }
  .barcode-wrap { text-align: center; padding: 8px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; margin: 8px 0 12px; }
  .barcode-wrap svg { display: block; margin: 0 auto; }
  .barcode-value { font-family: monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; margin-top: 4px; color: #0f172a; }
  .meta-row { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; padding: 3px 0; }
  .meta-row strong { color: #0f172a; }
  .payment-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; }
  .payment-prepaid { background: #dcfce7; color: #166534; }
  .payment-cod { background: #fef9c3; color: #854d0e; }
  .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  @media print {
    body { background: #fff; padding: 0; }
    .label { box-shadow: none; width: 4in; min-height: 6in; margin: 0; padding: 18px; }
    @page { size: 4in 6in; margin: 0; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="brand-bar">
      <span class="brand">Zubkas StorePulse</span>
      <span class="payment">${paymentLabel} · ${paymentAmount}</span>
    </div>

    <div class="from-to">
      <div class="section">
        <div class="section-label">From</div>
        <div class="addr-name">${SENDER.name}</div>
        <div class="addr-line">${SENDER.company}</div>
        <div class="addr-line">${SENDER.address}</div>
        <div class="phone">${SENDER.phone}</div>
      </div>
      <div class="section">
        <div class="section-label">To</div>
        <div class="addr-name">${order.customer}</div>
        <div class="addr-line">${order.shippingAddress}</div>
        <div class="phone">${order.phone}</div>
      </div>
    </div>

    <div class="section">
      <div class="courier-row">
        <span class="courier-name">${info.courier}</span>
        <span class="courier-awb">AWB: ${info.awb}</span>
      </div>
      ${info.estimatedDelivery ? `<div class="meta-row"><span>Est. Delivery</span><strong>${new Date(info.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>` : ''}
      <div class="meta-row"><span>Order ID</span><strong>${order.id}</strong></div>
      <div class="meta-row"><span>Order Date</span><strong>${order.date}</strong></div>
      <div class="meta-row"><span>Items</span><strong>${order.items}</strong></div>
    </div>

    <div class="barcode-wrap">
      ${barcodeSvg}
      <div class="barcode-value">${order.id.replace('#', '')}</div>
    </div>

    <div class="section">
      <div class="section-label">Payment</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span style="font-size:11px;color:#475569;">${order.paymentMethod}</span>
        <span class="payment-badge ${isCod ? 'payment-cod' : 'payment-prepaid'}">${paymentLabel} · ${paymentAmount}</span>
      </div>
    </div>

    <div class="footer">
      Zubkas Technology Private Limited · support@zubkas.com · This label was generated by Zubkas StorePulse
    </div>
  </div>
</body>
</html>`
}
