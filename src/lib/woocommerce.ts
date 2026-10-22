import type { Order, OrderStatus, Product, Customer, ProductType, TaxStatus, Backorders, DownloadableFile, ProductAttribute, ProductVariation } from '@/data/mockData'

export type { Order, OrderStatus, Product, Customer, ProductType, TaxStatus, Backorders, DownloadableFile, ProductAttribute, ProductVariation }

export type WooConnection = {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  connectedAt: string
}

/* ---------------- raw WooCommerce REST types ---------------- */

export type WooOrder = {
  id: number
  number: string
  status: string
  total: string
  currency: string
  date_created: string
  payment_method_title: string
  transaction_id: string
  customer_id: number
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address_1: string
    city: string
    state: string
    postcode: string
    country: string
  }
  shipping: {
    address_1: string
    city: string
    state: string
    postcode: string
    country: string
  }
  line_items: Array<{
    product_id: number
    name: string
    quantity: number
    total: string
    price: number
    sku?: string
  }>
}

export type WooProduct = {
  id: number
  name: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  on_sale: boolean
  stock_status: string
  stock_quantity: number | null
  total_sales: number
  type: string
  status: string
  virtual: boolean
  downloadable: boolean
  manage_stock: boolean
  backorders: string
  tax_status: string
  tax_class: string
  date_on_sale_from: string | null
  date_on_sale_to: string | null
  downloads: Array<{ id: string; name: string; file: string }>
  download_limit: number
  download_expiry: number
  categories: Array<{ id: number; name: string; slug: string }>
  images: Array<{ src: string; name: string }>
  short_description: string
  description: string
  attributes: Array<{
    id: number
    name: string
    position: number
    visible: boolean
    variation: boolean
    options: string[]
  }>
  tags: Array<{ id: number; name: string; slug: string }>
}

export type WooCustomer = {
  id: number
  first_name: string
  last_name: string
  email: string
  billing: {
    city: string
    state: string
    country: string
  }
  orders_count: number
  total_spent: string
  date_created: string
}

export type WooSalesReport = {
  totals: {
    total_sales: string
    total_orders: number
    total_items: number
    avg_order_value: string
  }
  intervals?: Array<{
    interval: string
    date_start: string
    subtotals: {
      total_sales: string
      total_orders: number
      total_items: number
    }
  }>
}

/* ---------------- connection helpers ---------------- */

const STORAGE_KEY = 'zubkas_woo_connection'

export function getConnection(): WooConnection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WooConnection) : null
  } catch {
    return null
  }
}

export function saveConnection(data: WooConnection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function clearConnection(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/* ---------------- cloud credential sync (Supabase) ---------------- */

import { getSupabase } from '@/lib/supabase'

export async function saveConnectionToCloud(data: WooConnection): Promise<void> {
  try {
    const sb = getSupabase()
    const { data: existing, error: selectError } = await sb
      .from('store_settings')
      .select('id')
      .maybeSingle()
    if (selectError) {
      console.error('[store_settings] select error:', selectError.message, selectError.code)
    }
    if (existing?.id) {
      const { error: updateError } = await sb
        .from('store_settings')
        .update({
          woocommerce_url: data.storeUrl,
          consumer_key: data.consumerKey,
          consumer_secret: data.consumerSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (updateError) {
        console.error('[store_settings] update error:', updateError.message, updateError.code)
      }
    } else {
      const { error: insertError } = await sb
        .from('store_settings')
        .insert([
          { woocommerce_url: data.storeUrl, consumer_key: data.consumerKey, consumer_secret: data.consumerSecret }
        ])
      if (insertError) {
        console.error('[store_settings] insert error:', insertError.message, insertError.code)
      }
    }
  } catch (err) {
    console.error('[store_settings] saveConnectionToCloud exception:', err)
  }
}

export async function fetchConnectionFromCloud(): Promise<WooConnection | null> {
  try {
    const sb = getSupabase()
    const { data, error } = await sb.from('store_settings').select('*').maybeSingle()
    if (error) {
      console.error('[store_settings] fetch error:', error.message, error.code)
      return null
    }
    if (!data) return null
    if (!data.woocommerce_url || !data.consumer_key) return null
    return {
      storeUrl: data.woocommerce_url,
      consumerKey: data.consumer_key,
      consumerSecret: data.consumer_secret ?? '',
      connectedAt: data.connected_at ?? new Date().toISOString(),
    }
  } catch (err) {
    console.error('[store_settings] fetchConnectionFromCloud exception:', err)
    return null
  }
}

export async function clearConnectionFromCloud(): Promise<void> {
  try {
    const sb = getSupabase()
    const { error } = await sb.from('store_settings').delete().eq('id', 1)
    if (error) {
      console.error('[store_settings] delete error:', error.message, error.code)
    }
  } catch (err) {
    console.error('[store_settings] clearConnectionFromCloud exception:', err)
  }
}

/* ---------------- low-level fetch with Basic Auth + CORS proxy fallback ---------------- */

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
]

export function normalizeStoreUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '')
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  return url
}

function appendAuthQuery(url: string, conn: WooConnection): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}consumer_key=${encodeURIComponent(conn.consumerKey)}&consumer_secret=${encodeURIComponent(conn.consumerSecret)}`
}

function isUsableResponse(res: Response): boolean {
  return res.ok || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
}

async function wooFetch<T>(conn: WooConnection, path: string, init?: RequestInit): Promise<T> {
  const base = normalizeStoreUrl(conn.storeUrl)
  const directUrl = `${base}/wp-json/wc/v3/${path}`
  const auth = btoa(`${conn.consumerKey}:${conn.consumerSecret}`)
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  // Direct attempt uses Basic Auth header; proxy fallback uses query params
  let res: Response | undefined
  try {
    res = await fetch(directUrl, { ...init, headers })
    if (!isUsableResponse(res)) {
      throw new Error(`Direct fetch failed: ${res.status}`)
    }
  } catch {
    res = undefined
    // Fall back to proxies with credentials in the query string
    const proxyUrl = appendAuthQuery(directUrl, conn)
    for (const proxy of CORS_PROXIES) {
      try {
        res = await fetch(proxy(proxyUrl), { ...init, headers })
        if (isUsableResponse(res)) break
      } catch {
        // try next proxy
      }
      res = undefined
    }
    if (!res) {
      throw new Error('Unable to reach your store. The request failed both directly and through CORS proxies. Check your store URL and that REST API is enabled.')
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      msg = body?.message ?? msg
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

/* ---------------- connection tester ---------------- */

export async function testConnection(conn: WooConnection): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await wooFetch(conn, 'system_status', { method: 'GET' })
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach your store.'
    return { ok: false, error: msg }
  }
}

/* ---------------- mappers: Woo REST -> app domain types ---------------- */

function mapStatus(s: string): OrderStatus {
  const normalized = s.toLowerCase().replace(/_/g, ' ')
  const valid: OrderStatus[] = ['Processing', 'Completed', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery']
  const found = valid.find((v) => v.toLowerCase() === normalized)
  return found ?? 'Processing'
}

function mapPayment(s: string): 'Paid' | 'Pending' | 'Refunded' {
  const n = s.toLowerCase()
  if (n === 'paid' || n === 'processing' || n === 'completed') return 'Paid'
  if (n === 'refunded') return 'Refunded'
  return 'Pending'
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function mapOrder(o: WooOrder): Order {
  const fullAddr = (b: WooOrder['billing']) =>
    [b.address_1, b.city, b.state, b.postcode, b.country].filter(Boolean).join(', ')
  const shipAddr = (s: WooOrder['shipping']) =>
    [s.address_1, s.city, s.state, s.postcode, s.country].filter(Boolean).join(', ')

  return {
    id: `#${o.number || String(o.id)}`,
    customer: `${o.billing.first_name} ${o.billing.last_name}`.trim() || 'Guest',
    customerId: String(o.customer_id ?? ''),
    email: o.billing.email || '',
    phone: o.billing.phone || '',
    billingAddress: fullAddr(o.billing),
    shippingAddress: shipAddr(o.shipping) || fullAddr(o.billing),
    items: o.line_items?.length ?? 0,
    total: Number(o.total) || 0,
    payment: mapPayment(o.status),
    paymentMethod: o.payment_method_title || '—',
    transactionId: o.transaction_id || '—',
    date: fmtDate(o.date_created),
    status: mapStatus(o.status),
    lineItems: (o.line_items ?? []).map((li) => ({
      productId: String(li.product_id),
      name: li.name,
      thumbnail: '📦',
      quantity: li.quantity,
      unitPrice: Number(li.price) || Number(li.total) || 0,
    })),
  }
}

function mapProduct(p: WooProduct): Product {
  const category = p.categories?.[0]?.name ?? 'Uncategorized'
  const price = Number(p.regular_price || p.price) || 0
  const sale = p.sale_price ? Number(p.sale_price) : null
  const stock = p.stock_quantity ?? (p.stock_status === 'instock' ? 99 : 0)
  const prodType: ProductType = p.type === 'variable' ? 'variable' : 'simple'
  return {
    id: String(p.id),
    name: p.name,
    sku: p.sku || `SKU-${p.id}`,
    category,
    price,
    salePrice: sale,
    stock,
    unitsSold: p.total_sales ?? 0,
    image: '📦',
    imageUrl: p.images?.[0]?.src ?? '',
    description: p.short_description?.replace(/<[^>]*>/g, '') || '',
    fullDescription: p.description?.replace(/<[^>]*>/g, '') || '',
    type: prodType,
    virtual: !!p.virtual,
    downloadable: !!p.downloadable,
    manageStock: p.manage_stock ?? false,
    stockStatus: p.stock_status === 'outofstock' ? 'outofstock' : 'instock',
    backorders: (['no', 'notify', 'yes'].includes(p.backorders) ? p.backorders : 'no') as Backorders,
    taxStatus: (['taxable', 'none'].includes(p.tax_status) ? p.tax_status : 'taxable') as TaxStatus,
    taxClass: p.tax_class || '',
    saleStartDate: p.date_on_sale_from ?? '',
    saleEndDate: p.date_on_sale_to ?? '',
    downloads: (p.downloads ?? []).map((d) => ({ id: d.id || String(Math.random()), name: d.name, file: d.file })),
    downloadLimit: p.download_limit ?? 0,
    downloadExpiry: p.download_expiry ?? 0,
    attributes: (p.attributes ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      position: a.position,
      visible: a.visible,
      variation: a.variation,
      options: a.options,
    })),
    variations: [],
    tags: (p.tags ?? []).map((t) => t.name),
  }
}

function mapCustomer(c: WooCustomer): Customer {
  const loc = [c.billing.city, c.billing.state, c.billing.country].filter(Boolean).join(', ') || '—'
  return {
    id: String(c.id),
    name: `${c.first_name} ${c.last_name}`.trim() || c.email,
    email: c.email,
    location: loc,
    orders: c.orders_count ?? 0,
    spent: Number(c.total_spent) || 0,
    joined: fmtDate(c.date_created),
  }
}

/* ---------------- high-level API ---------------- */

export async function fetchOrders(conn: WooConnection, perPage = 50): Promise<Order[]> {
  const data = await wooFetch<WooOrder[]>(conn, `orders?per_page=${perPage}&orderby=date&order=desc`)
  return data.map(mapOrder)
}

export async function fetchProducts(conn: WooConnection, perPage = 50): Promise<Product[]> {
  const data = await wooFetch<WooProduct[]>(conn, `products?per_page=${perPage}&status=publish`)
  return data.map(mapProduct)
}

export async function fetchCustomers(conn: WooConnection, perPage = 50): Promise<Customer[]> {
  const data = await wooFetch<WooCustomer[]>(conn, `customers?per_page=${perPage}&orderby=registered_date&order=desc`)
  return data.map(mapCustomer)
}

export type SalesReportData = {
  totalSales: number
  totalOrders: number
  avgOrderValue: number
  intervals: Array<{ label: string; revenue: number; orders: number }>
}

export async function fetchSalesReport(conn: WooConnection): Promise<SalesReportData | null> {
  try {
    const data = await wooFetch<WooSalesReport>(conn, 'reports/sales?period=month')
    const intervals = (data.intervals ?? []).map((iv) => ({
      label: iv.interval,
      revenue: Number(iv.subtotals.total_sales) || 0,
      orders: iv.subtotals.total_orders || 0,
    }))
    return {
      totalSales: Number(data.totals.total_sales) || 0,
      totalOrders: data.totals.total_orders || 0,
      avgOrderValue: Number(data.totals.avg_order_value) || 0,
      intervals,
    }
  } catch {
    return null
  }
}

/* ---------------- WordPress Media Library upload ---------------- */

export type UploadedMedia = {
  id: number
  sourceUrl: string
}

export async function uploadMediaToWordPress(conn: WooConnection, file: File): Promise<UploadedMedia> {
  const base = normalizeStoreUrl(conn.storeUrl)
  const url = `${base}/wp-json/wp/v2/media`
  const auth = btoa(`${conn.consumerKey}:${conn.consumerSecret}`)

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Disposition': `attachment; filename="${file.name.replace(/"/g, '')}"`,
  }

  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers, body: file })
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      throw new Error(`Upload failed: ${res.status}`)
    }
  } catch {
    const proxyUrl = appendAuthQuery(url, conn)
    res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(proxyUrl)}`, { method: 'POST', headers, body: file })
  }

  if (!res.ok) {
    let msg = `Upload failed (${res.status})`
    try {
      const body = await res.json()
      msg = body?.message ?? msg
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as { id: number; source_url: string }
  return { id: data.id, sourceUrl: data.source_url }
}

export async function updateOrderStatus(conn: WooConnection, orderId: string, status: OrderStatus): Promise<void> {
  const numericId = orderId.replace(/[^0-9]/g, '')
  await wooFetch(conn, `orders/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: status.toLowerCase().replace(' ', '_') }),
  })
}

export type OrderShippingUpdate = {
  courier: string
  awb: string
  trackingUrl: string
  estimatedDelivery: string
}

export async function updateOrderShipping(conn: WooConnection, orderId: string, update: OrderShippingUpdate): Promise<void> {
  const numericId = orderId.replace(/[^0-9]/g, '')
  const meta: Record<string, string> = {
    _zubkas_courier: update.courier,
    _zubkas_awb: update.awb,
    _zubkas_tracking_url: update.trackingUrl,
    _zubkas_estimated_delivery: update.estimatedDelivery,
    _zubkas_shipped_at: new Date().toISOString(),
  }
  await wooFetch(conn, `orders/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'completed',
      meta_data: Object.entries(meta).map(([key, value]) => ({ key, value })),
    }),
  })
}

export type DeliveryAssignmentUpdate = {
  staffId: string
  staffName: string
  staffPhone: string
  vehicle: string
}

export async function assignOrderDelivery(conn: WooConnection, orderId: string, update: DeliveryAssignmentUpdate): Promise<void> {
  const numericId = orderId.replace(/[^0-9]/g, '')
  const meta: Record<string, string> = {
    _zubkas_delivery_staff_id: update.staffId,
    _zubkas_delivery_staff_name: update.staffName,
    _zubkas_delivery_staff_phone: update.staffPhone,
    _zubkas_delivery_vehicle: update.vehicle,
    _zubkas_delivery_assigned_at: new Date().toISOString(),
    _assigned_delivery_staff: update.staffName,
    _delivery_staff_phone: update.staffPhone,
    _delivery_status: 'out_for_delivery',
  }
  await wooFetch(conn, `orders/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify({
      meta_data: Object.entries(meta).map(([key, value]) => ({ key, value })),
    }),
  })
}

export async function completeOrderDelivery(conn: WooConnection, orderId: string, signatureDataUrl: string): Promise<void> {
  const numericId = orderId.replace(/[^0-9]/g, '')
  await wooFetch(conn, `orders/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'completed',
      meta_data: [
        { key: '_zubkas_delivery_signature', value: signatureDataUrl },
        { key: '_zubkas_delivery_completed_at', value: new Date().toISOString() },
      ],
    }),
  })
}

export type CreateProductInput = {
  name: string
  sku: string
  category: string
  price: number
  salePrice: number | null
  stock: number
  manageStock: boolean
  stockStatus: 'instock' | 'outofstock'
  imageUrl: string
  description: string
  type: ProductType
  virtual: boolean
  downloadable: boolean
  backorders: Backorders
  taxStatus: TaxStatus
  taxClass: string
  saleStartDate: string
  saleEndDate: string
  downloads: DownloadableFile[]
  downloadLimit: number
  downloadExpiry: number
  attributes: ProductAttribute[]
  variations: ProductVariation[]
  tags: string[]
  fullDescription: string
}

export type PosCartLine = {
  productId: string
  name: string
  price: number
  quantity: number
}

export type CreatePosOrderInput = {
  lines: PosCartLine[]
  customerName: string
  customerPhone: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: 'cash' | 'upi' | 'card'
  paymentMethodTitle: string
}

export type CreatedPosOrder = {
  id: string
  number: string
  total: number
  date: string
}

const POS_PAYMENT_SLUGS: Record<CreatePosOrderInput['paymentMethod'], string> = {
  cash: 'cod',
  upi: 'cod',
  card: 'cod',
}

export async function createPosOrder(conn: WooConnection, input: CreatePosOrderInput): Promise<CreatedPosOrder> {
  const isWalkIn = !input.customerName.trim() || input.customerName.trim() === 'Walk-in Customer'
  const [first, ...rest] = (isWalkIn ? 'Walk-in Customer' : input.customerName.trim()).split(/\s+/)
  const last = rest.join(' ') || 'Customer'
  const phone = input.customerPhone.trim() || '0000000000'
  const email = isWalkIn ? 'pos@store.local' : `pos+${Date.now()}@store.local`

  const body: Record<string, unknown> = {
    status: 'completed',
    payment_method: POS_PAYMENT_SLUGS[input.paymentMethod] ?? 'cod',
    payment_method_title: input.paymentMethodTitle,
    set_paid: true,
    billing: {
      first_name: first,
      last_name: last,
      phone,
      email,
      address_1: 'POS Counter',
      city: '',
      state: '',
      postcode: '',
      country: 'IN',
    },
    shipping: {
      first_name: first,
      last_name: last,
      phone,
      address_1: 'POS Counter',
      city: '',
      state: '',
      postcode: '',
      country: 'IN',
    },
    line_items: input.lines.map((l) => ({
      product_id: Number(l.productId),
      quantity: Number(l.quantity),
    })),
  }

  const feeLines: Array<{ name: string; total: string; total_tax: string }> = []
  if (input.discount > 0) {
    feeLines.push({ name: 'Discount', total: String(-input.discount), total_tax: '0' })
  }
  if (input.tax > 0) {
    feeLines.push({ name: 'Tax', total: String(input.tax), total_tax: '0' })
  }
  if (feeLines.length > 0) {
    body.fee_lines = feeLines
  }

  const created = await wooFetch<WooOrder>(conn, 'orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return {
    id: `#${created.number || String(created.id)}`,
    number: created.number || String(created.id),
    total: Number(created.total) || input.total,
    date: fmtDate(created.date_created),
  }
}

/* ---------------- Coupons ---------------- */

export type CouponDiscountType = 'percent' | 'fixed_cart' | 'fixed_product'

export type Coupon = {
  id: string
  code: string
  discountType: CouponDiscountType
  amount: number
  minimumSpend: number
  usageLimit: number
  usageCount: number
  expiryDate: string
  freeShipping: boolean
}

export type WooCoupon = {
  id: number
  code: string
  discount_type: string
  amount: string
  minimum_amount: string
  usage_limit: number
  usage_count: number
  date_expires: string | null
  free_shipping: boolean
}

export type CreateCouponInput = {
  code: string
  discountType: CouponDiscountType
  amount: number
  minimumSpend: number
  usageLimit: number
  expiryDate: string
  freeShipping: boolean
}

const DISCOUNT_TYPE_LABELS: Record<CouponDiscountType, string> = {
  percent: 'Percentage discount',
  fixed_cart: 'Fixed cart discount',
  fixed_product: 'Fixed product discount',
}

export function discountTypeLabel(t: CouponDiscountType): string {
  return DISCOUNT_TYPE_LABELS[t]
}

function mapCoupon(c: WooCoupon): Coupon {
  let type: CouponDiscountType = 'percent'
  if (c.discount_type === 'fixed_cart') type = 'fixed_cart'
  else if (c.discount_type === 'fixed_product') type = 'fixed_product'
  else if (c.discount_type === 'percent') type = 'percent'

  return {
    id: String(c.id),
    code: c.code,
    discountType: type,
    amount: Number(c.amount) || 0,
    minimumSpend: Number(c.minimum_amount) || 0,
    usageLimit: c.usage_limit ?? 0,
    usageCount: c.usage_count ?? 0,
    expiryDate: c.date_expires ? fmtDate(c.date_expires) : '',
    freeShipping: !!c.free_shipping,
  }
}

export async function fetchCoupons(conn: WooConnection, perPage = 50): Promise<Coupon[]> {
  const data = await wooFetch<WooCoupon[]>(conn, `coupons?per_page=${perPage}&orderby=id&order=desc`)
  return data.map(mapCoupon)
}

export async function createCoupon(conn: WooConnection, input: CreateCouponInput): Promise<Coupon> {
  const body: Record<string, unknown> = {
    code: input.code,
    discount_type: input.discountType,
    amount: String(input.amount),
    minimum_amount: String(input.minimumSpend),
    usage_limit: input.usageLimit,
    free_shipping: input.freeShipping,
  }
  if (input.expiryDate) {
    body.date_expires = input.expiryDate
  }
  const created = await wooFetch<WooCoupon>(conn, 'coupons', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return mapCoupon(created)
}

export async function deleteCoupon(conn: WooConnection, couponId: string): Promise<void> {
  await wooFetch(conn, `coupons/${couponId}?force=true`, { method: 'DELETE' })
}

function buildProductBody(input: CreateProductInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: input.name,
    regular_price: String(input.price),
    sku: input.sku,
    manage_stock: input.manageStock,
    short_description: input.description,
    description: input.fullDescription,
    type: input.type,
    virtual: input.virtual,
    downloadable: input.downloadable,
    backorders: input.backorders,
    tax_status: input.taxStatus,
    tax_class: input.taxClass,
    status: 'publish',
  }
  if (input.manageStock) {
    body.stock_quantity = input.stock
    body.in_stock = input.stockStatus === 'instock'
    body.stock_status = input.stockStatus
  } else {
    body.stock_status = input.stockStatus === 'instock' ? 'instock' : 'outofstock'
    body.in_stock = input.stockStatus === 'instock'
  }
  if (input.category) {
    body.categories = [{ name: input.category }]
  }
  if (input.tags.length > 0) {
    body.tags = input.tags.map((t) => ({ name: t }))
  }
  if (input.salePrice !== null && input.salePrice < input.price) {
    body.sale_price = String(input.salePrice)
    body.on_sale = true
    if (input.saleStartDate) body.date_on_sale_from = input.saleStartDate
    if (input.saleEndDate) body.date_on_sale_to = input.saleEndDate
  } else {
    body.sale_price = ''
    body.on_sale = false
  }
  if (input.imageUrl.trim()) {
    body.images = [{ src: input.imageUrl.trim() }]
  }
  if (input.downloadable) {
    body.downloads = input.downloads
      .filter((d) => d.name.trim() && d.file.trim())
      .map((d) => ({ name: d.name.trim(), file: d.file.trim() }))
    body.download_limit = input.downloadLimit
    body.download_expiry = input.downloadExpiry
  }
  if (input.attributes.length > 0) {
    body.attributes = input.attributes.map((a) => ({
      name: a.name,
      position: a.position,
      visible: a.visible,
      variation: a.variation,
      options: a.options,
    }))
  }
  return body
}

export async function createProduct(conn: WooConnection, input: CreateProductInput): Promise<Product> {
  const body = buildProductBody(input)
  const created = await wooFetch<WooProduct>(conn, 'products', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const mapped = mapProduct(created)
  // If variable product with variations, create them
  if (input.type === 'variable' && input.variations.length > 0) {
    const variations: ProductVariation[] = []
    for (const v of input.variations) {
      try {
        const vBody: Record<string, unknown> = {
          sku: v.sku,
          regular_price: v.price,
          attributes: v.attributes,
        }
        if (v.salePrice) {
          vBody.sale_price = v.salePrice
        }
        const createdV = await wooFetch<WooProduct>(conn, `products/${created.id}/variations`, {
          method: 'POST',
          body: JSON.stringify(vBody),
        })
        variations.push({
          id: String(createdV.id),
          sku: v.sku,
          price: v.price,
          salePrice: v.salePrice,
          attributes: v.attributes,
        })
      } catch {
        // skip failed variation
      }
    }
    mapped.variations = variations
  }
  return mapped
}

export type UpdateProductInput = Partial<CreateProductInput> & {
  name?: string
}

export async function updateProduct(conn: WooConnection, productId: string, input: UpdateProductInput): Promise<Product> {
  const fullInput: CreateProductInput = {
    name: input.name ?? '',
    sku: input.sku ?? '',
    category: input.category ?? '',
    price: input.price ?? 0,
    salePrice: input.salePrice ?? null,
    stock: input.stock ?? 0,
    manageStock: input.manageStock ?? false,
    stockStatus: input.stockStatus ?? 'instock',
    imageUrl: input.imageUrl ?? '',
    description: input.description ?? '',
    type: input.type ?? 'simple',
    virtual: input.virtual ?? false,
    downloadable: input.downloadable ?? false,
    backorders: input.backorders ?? 'no',
    taxStatus: input.taxStatus ?? 'taxable',
    taxClass: input.taxClass ?? '',
    saleStartDate: input.saleStartDate ?? '',
    saleEndDate: input.saleEndDate ?? '',
    downloads: input.downloads ?? [],
    downloadLimit: input.downloadLimit ?? 0,
    downloadExpiry: input.downloadExpiry ?? 0,
    attributes: input.attributes ?? [],
    variations: input.variations ?? [],
    tags: input.tags ?? [],
    fullDescription: input.fullDescription ?? '',
  }
  const body = buildProductBody(fullInput)
  const updated = await wooFetch<WooProduct>(conn, `products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return mapProduct(updated)
}

export async function deleteProduct(conn: WooConnection, productId: string): Promise<void> {
  await wooFetch(conn, `products/${productId}?force=true`, { method: 'DELETE' })
}

export async function updateProductField(
  conn: WooConnection,
  productId: string,
  field: 'regular_price' | 'stock_quantity' | 'sale_price',
  value: number | string,
): Promise<Product> {
  const body: Record<string, unknown> = { [field]: String(value) }
  if (field === 'sale_price') {
    body.on_sale = true
  }
  const updated = await wooFetch<WooProduct>(conn, `products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return mapProduct(updated)
}
