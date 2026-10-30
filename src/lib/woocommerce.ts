import type { Order, OrderStatus, Product, Customer, ProductType, TaxStatus, Backorders, DownloadableFile, ProductAttribute, ProductVariation } from '@/data/mockData'

export type { Order, OrderStatus, Product, Customer, ProductType, TaxStatus, Backorders, DownloadableFile, ProductAttribute, ProductVariation }

export type WooConnection = {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  wpUsername: string
  wpAppPassword: string
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

export type WooVariation = {
  id: number
  sku: string
  regular_price: string
  sale_price: string
  stock_status: string
  manage_stock: boolean
  stock_quantity: number | null
  attributes: Array<{ id: number; name: string; option: string }>
  weight: string
  image: { src: string } | null
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
  weight: string | null
  dimensions: { length: string; width: string; height: string } | null
  shipping_class: string | null
  global_unique_id: string | null
  sold_individually: boolean
  unit_of_measure: string | null
  upsell_ids: number[]
  cross_sell_ids: number[]
  purchase_note: string
  menu_order: number
  reviews_allowed: boolean
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
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WooConnection>
    return { wpUsername: '', wpAppPassword: '', ...parsed } as WooConnection
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
  const sb = getSupabase()
  const { data: existing, error: selectError } = await sb
    .from('store_settings')
    .select('id')
    .maybeSingle()
  if (selectError) throw new Error(`Could not read store settings: ${selectError.message}`)

  const credentials = {
    woocommerce_url: data.storeUrl,
    consumer_key: data.consumerKey,
    consumer_secret: data.consumerSecret,
    wordpress_username: data.wpUsername,
    wordpress_application_password: data.wpAppPassword,
    is_connected: true,
  }

  if (existing?.id) {
    const { error: updateError } = await sb
      .from('store_settings')
      .update({ ...credentials, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updateError) throw new Error(`Could not save store settings: ${updateError.message}`)
  } else {
    const { error: insertError } = await sb.from('store_settings').insert([credentials])
    if (insertError) throw new Error(`Could not save store settings: ${insertError.message}`)
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
    if (data.is_connected === false) return null
    return {
      storeUrl: data.woocommerce_url,
      consumerKey: data.consumer_key,
      consumerSecret: data.consumer_secret ?? '',
      wpUsername: data.wordpress_username ?? '',
      wpAppPassword: data.wordpress_application_password ?? '',
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
    const { error } = await sb
      .from('store_settings')
      .update({
        woocommerce_url: '',
        consumer_key: '',
        consumer_secret: '',
        wordpress_username: '',
        wordpress_application_password: '',
        is_connected: false,
        updated_at: new Date().toISOString(),
      })
      .neq('id', 0)
    if (error) {
      console.error('[store_settings] disconnect update error:', error.message, error.code)
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

function mapProduct(p: WooProduct, variations: ProductVariation[] = []): Product {
  const category = p.categories?.[0]?.name ?? 'Uncategorized'
  const price = Number(p.regular_price || p.price) || 0
  const sale = p.sale_price ? Number(p.sale_price) : null
  const stock = p.stock_quantity ?? (p.stock_status === 'instock' ? 99 : 0)
  const prodType: ProductType = p.type === 'variable' ? 'variable' : 'simple'
  return {
    id: String(p.id),
    name: p.name,
    sku: p.sku || `SKU-${p.id}`,
    gtin: p.global_unique_id ?? '',
    category,
    price,
    salePrice: sale,
    stock,
    unitsSold: p.total_sales ?? 0,
    image: '📦',
    imageUrl: p.images?.[0]?.src ?? '',
    galleryImages: (p.images ?? []).slice(1).map((img) => img.src).filter((s) => s.trim() !== ''),
    description: p.short_description?.replace(/<[^>]*>/g, '') || '',
    fullDescription: p.description?.replace(/<[^>]*>/g, '') || '',
    type: prodType,
    virtual: !!p.virtual,
    downloadable: !!p.downloadable,
    manageStock: p.manage_stock ?? false,
    stockStatus: p.stock_status === 'outofstock' ? 'outofstock' : 'instock',
    backorders: (['no', 'notify', 'yes'].includes(p.backorders) ? p.backorders : 'no') as Backorders,
    soldIndividually: !!p.sold_individually,
    unitOfMeasure: p.unit_of_measure ?? '',
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
    variations,
    tags: (p.tags ?? []).map((t) => t.name),
    weight: p.weight ?? '',
    length: p.dimensions?.length ?? '',
    width: p.dimensions?.width ?? '',
    height: p.dimensions?.height ?? '',
    shippingClass: p.shipping_class ?? '',
    upsellIds: (p.upsell_ids ?? []).map(String),
    crossSellIds: (p.cross_sell_ids ?? []).map(String),
    purchaseNote: p.purchase_note ?? '',
    menuOrder: p.menu_order ?? 0,
    reviewsEnabled: p.reviews_allowed !== false,
    posAvailable: true,
  }
}

function mapVariation(v: WooVariation): ProductVariation {
  return {
    id: String(v.id),
    sku: v.sku || '',
    price: v.regular_price || '0',
    salePrice: v.sale_price ? v.sale_price : null,
    stockStatus: v.stock_status === 'outofstock' ? 'outofstock' : 'instock',
    attributes: (v.attributes ?? []).map((a) => ({ name: a.name, option: a.option })),
    imageUrl: v.image?.src ?? '',
    weight: v.weight ?? '',
  }
}

function mapCustomer(c: WooCustomer): Customer {
  const b = c.billing
  const loc = [b.city, b.state, b.country].filter(Boolean).join(', ') || '—'
  const addr = [b.address_1, b.city, b.state, b.postcode, b.country].filter(Boolean).join(', ') || '—'
  return {
    id: String(c.id),
    name: `${c.first_name} ${c.last_name}`.trim() || c.email,
    email: c.email || '',
    phone: b.phone || '',
    location: loc,
    address: addr,
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
  const products = data.map((p) => mapProduct(p))
  const variableProducts = products.filter((p) => p.type === 'variable')
  if (variableProducts.length > 0) {
    await Promise.all(
      variableProducts.map(async (p) => {
        try {
          const vData = await wooFetch<WooVariation[]>(conn, `products/${p.id}/variations?per_page=100`)
          p.variations = vData.map(mapVariation)
        } catch {
          // variations fetch failed — leave empty
        }
      }),
    )
  }
  return products
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

/* ---------------- image helpers ---------------- */

// WooCommerce's product endpoint accepts a Base64 data URL directly in
// images[].src and uploads it to the Media Library server-side. This avoids
// calling the WordPress core /wp/v2/media endpoint, which requires separate
// application-password/authenticated-user credentials and returns 401 for the
// WooCommerce REST API keys the app stores.

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
  gtin: string
  category: string
  price: number
  salePrice: number | null
  stock: number
  manageStock: boolean
  stockStatus: 'instock' | 'outofstock'
  soldIndividually: boolean
  unitOfMeasure: string
  imageUrl: string
  galleryImages: string[]
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
  weight: string
  length: string
  width: string
  height: string
  shippingClass: string
  upsellIds: string[]
  crossSellIds: string[]
  purchaseNote: string
  menuOrder: number
  reviewsEnabled: boolean
  posAvailable: boolean
}

export type PosCartLine = {
  productId: string
  variationId: string | null
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
    line_items: input.lines.map((l) => {
      const item: Record<string, unknown> = {
        quantity: Number(l.quantity),
      }
      if (l.variationId) {
        item.product_id = Number(l.productId.includes('-') ? l.productId.split('-')[0] : l.productId)
        item.variation_id = Number(l.variationId)
      } else {
        item.product_id = Number(l.productId)
      }
      return item
    }),
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
  isActive?: boolean
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

async function buildProductBody(input: CreateProductInput): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    name: input.name,
    regular_price: String(input.price),
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
  if (input.sku.trim()) body.sku = input.sku.trim()
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
  // WooCommerce only fetches public http(s) image URLs; data URLs are rejected.
  const isValidSrc = (s: string): boolean => /^https?:\/\//i.test(s.trim())
  const featuredSrc = input.imageUrl.trim()
  const imageSrcs = [featuredSrc, ...input.galleryImages].filter(isValidSrc)
  body.images = imageSrcs.map((src) => ({ src: src.trim() }))
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
  if (input.weight.trim()) body.weight = input.weight.trim()
  const dims: Record<string, string> = {}
  if (input.length.trim()) dims.length = input.length.trim()
  if (input.width.trim()) dims.width = input.width.trim()
  if (input.height.trim()) dims.height = input.height.trim()
  if (Object.keys(dims).length > 0) body.dimensions = dims
  if (input.shippingClass.trim()) body.shipping_class = input.shippingClass.trim()
  if (input.gtin.trim()) body.global_unique_id = input.gtin.trim()
  if (input.soldIndividually) body.sold_individually = true
  if (input.unitOfMeasure.trim()) body.unit_of_measure = input.unitOfMeasure.trim()
  if (input.upsellIds.length > 0) body.upsell_ids = input.upsellIds.map(Number).filter((n) => !isNaN(n))
  if (input.crossSellIds.length > 0) body.cross_sell_ids = input.crossSellIds.map(Number).filter((n) => !isNaN(n))
  if (input.purchaseNote.trim()) body.purchase_note = input.purchaseNote.trim()
  if (input.menuOrder > 0) body.menu_order = input.menuOrder
  body.reviews_allowed = input.reviewsEnabled
  if (!input.posAvailable) {
    body.meta_data = [{ key: '_zubkas_pos_available', value: '0' }]
  } else {
    body.meta_data = [{ key: '_zubkas_pos_available', value: '1' }]
  }
  return body
}

export async function createProduct(conn: WooConnection, input: CreateProductInput): Promise<Product> {
  const body = await buildProductBody(input)
  const created = await sendWithSkuFallback(body, (b) =>
    wooFetch<WooProduct>(conn, 'products', { method: 'POST', body: JSON.stringify(b) }),
  )
  const mapped = mapProduct(created)
  // If variable product with variations, create them
  if (input.type === 'variable' && input.variations.length > 0) {
    const variations: ProductVariation[] = []
    for (const v of input.variations) {
      const vBody: Record<string, unknown> = {
        regular_price: v.price,
        attributes: v.attributes,
        stock_status: v.stockStatus ?? 'instock',
        manage_stock: false,
        weight: v.weight,
      }
      if (v.sku.trim()) vBody.sku = v.sku.trim()
      if (v.salePrice) vBody.sale_price = v.salePrice
      if (/^https?:\/\//i.test(v.imageUrl)) vBody.image = { src: v.imageUrl }
      const createdV = await sendWithSkuFallback(vBody, (b) =>
        wooFetch<WooVariation>(conn, `products/${created.id}/variations`, { method: 'POST', body: JSON.stringify(b) }),
      )
      variations.push(mapVariation(createdV))
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
    gtin: input.gtin ?? '',
    category: input.category ?? '',
    price: input.price ?? 0,
    salePrice: input.salePrice ?? null,
    stock: input.stock ?? 0,
    manageStock: input.manageStock ?? false,
    stockStatus: input.stockStatus ?? 'instock',
    soldIndividually: input.soldIndividually ?? false,
    unitOfMeasure: input.unitOfMeasure ?? '',
    imageUrl: input.imageUrl ?? '',
    galleryImages: input.galleryImages ?? [],
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
    weight: input.weight ?? '',
    length: input.length ?? '',
    width: input.width ?? '',
    height: input.height ?? '',
    shippingClass: input.shippingClass ?? '',
    upsellIds: input.upsellIds ?? [],
    crossSellIds: input.crossSellIds ?? [],
    purchaseNote: input.purchaseNote ?? '',
    menuOrder: input.menuOrder ?? 0,
    reviewsEnabled: input.reviewsEnabled ?? true,
    posAvailable: input.posAvailable ?? true,
  }
  return saveProduct(conn, productId, fullInput)
}

function isSkuError(err: unknown): boolean {
  return err instanceof Error && /duplicated sku|invalid sku/i.test(err.message)
}

// WooCommerce rejects a SKU that is already used by another product or variation.
// Retry the same request without the SKU so the rest of the save still goes through.
async function sendWithSkuFallback<T>(body: Record<string, unknown>, send: (body: Record<string, unknown>) => Promise<T>): Promise<T> {
  try {
    return await send(body)
  } catch (err) {
    if (!isSkuError(err) || !('sku' in body)) throw err
    const retry = { ...body }
    delete retry.sku
    return send(retry)
  }
}

async function saveProduct(conn: WooConnection, productId: string, input: CreateProductInput): Promise<Product> {
  const body = await buildProductBody(input)
  const updated = await sendWithSkuFallback(body, (b) =>
    wooFetch<WooProduct>(conn, `products/${productId}`, { method: 'PUT', body: JSON.stringify(b) }),
  )
  const mapped = mapProduct(updated)
  if (input.type === 'variable') {
    mapped.variations = await syncVariations(conn, productId, input.variations)
  }
  return mapped
}

async function syncVariations(conn: WooConnection, productId: string, variations: ProductVariation[]): Promise<ProductVariation[]> {
  const synced: ProductVariation[] = []
  for (const v of variations) {
    const vBody: Record<string, unknown> = {
      regular_price: v.price,
      sale_price: v.salePrice ?? '',
      attributes: v.attributes,
      stock_status: v.stockStatus,
      weight: v.weight,
      image: /^https?:\/\//i.test(v.imageUrl) ? { src: v.imageUrl } : null,
    }
    if (v.sku.trim()) vBody.sku = v.sku.trim()
    const isNew = v.id.startsWith('new-')
    const path = isNew ? `products/${productId}/variations` : `products/${productId}/variations/${v.id}`
    const method = isNew ? 'POST' : 'PUT'
    const saved = await sendWithSkuFallback(vBody, (b) =>
      wooFetch<WooVariation>(conn, path, { method, body: JSON.stringify(b) }),
    )
    synced.push(mapVariation(saved))
  }
  return synced
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

/* ---------------- Customer CRUD (WooCommerce) ---------------- */

export type CreateCustomerInput = {
  name: string
  email: string
  phone: string
  address: string
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>

function parseName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  const first = parts[0] || ''
  const last = parts.slice(1).join(' ') || ''
  return { first, last }
}

function parseAddress(addr: string): { address_1: string; city: string; state: string; postcode: string; country: string } {
  const parts = addr.split(',').map((s) => s.trim())
  return {
    address_1: parts[0] || '',
    city: parts[1] || '',
    state: parts[2] || '',
    postcode: parts[3] || '',
    country: parts[4] || 'IN',
  }
}

export async function createWooCustomer(conn: WooConnection, input: CreateCustomerInput): Promise<Customer> {
  const { first, last } = parseName(input.name)
  const addr = parseAddress(input.address)
  const body = {
    first_name: first,
    last_name: last,
    email: input.email,
    billing: {
      first_name: first,
      last_name: last,
      email: input.email,
      phone: input.phone,
      ...addr,
    },
    shipping: {
      first_name: first,
      last_name: last,
      ...addr,
    },
  }
  const created = await wooFetch<WooCustomer>(conn, 'customers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return mapCustomer(created)
}

export async function updateWooCustomer(conn: WooConnection, customerId: string, input: UpdateCustomerInput): Promise<Customer> {
  const body: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const { first, last } = parseName(input.name)
    body.first_name = first
    body.last_name = last
    body.billing = { first_name: first, last_name: last }
  }
  if (input.email !== undefined) {
    body.email = input.email
    body.billing = { ...(body.billing as Record<string, unknown> || {}), email: input.email }
  }
  if (input.phone !== undefined) {
    body.billing = { ...(body.billing as Record<string, unknown> || {}), phone: input.phone }
  }
  if (input.address !== undefined) {
    const addr = parseAddress(input.address)
    body.billing = { ...(body.billing as Record<string, unknown> || {}), ...addr }
    body.shipping = { ...addr }
  }
  const numericId = customerId.replace(/[^0-9]/g, '')
  const updated = await wooFetch<WooCustomer>(conn, `customers/${numericId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return mapCustomer(updated)
}

export async function deleteWooCustomer(conn: WooConnection, customerId: string): Promise<void> {
  const numericId = customerId.replace(/[^0-9]/g, '')
  await wooFetch(conn, `customers/${numericId}?force=true`, { method: 'DELETE' })
}

/* ---------------- Category fetching (WooCommerce) ---------------- */

export type WooCategory = {
  id: number
  name: string
  slug: string
  count: number
}

export async function fetchWooCategories(conn: WooConnection, perPage = 100): Promise<WooCategory[]> {
  return wooFetch<WooCategory[]>(conn, `products/categories?per_page=${perPage}&orderby=name&order=asc`)
}
