import { getSupabase } from '@/lib/supabase'
import type { Product, Order, OrderStatus, OrderLineItem, Backorders, TaxStatus } from '@/data/mockData'

/* ---------------- row types ---------------- */

type ProductImage = { src?: string; [k: string]: unknown }

export type ProductRow = {
  id: string
  name: string
  sku: string
  category: string
  categories: string | ProductImage[] | null
  regular_price: number
  sale_price: number | null
  stock_quantity: number
  stock_status: string | null
  image_url: string | null
  images: ProductImage[] | string | null
  gallery_images: unknown
  description: string | null
  attributes: Array<{ id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }> | null
  variations: Array<{ id: string; sku: string; price: string; salePrice: string | null; stockStatus: 'instock' | 'outofstock'; attributes: Array<{ name: string; option: string }>; imageUrl: string; weight: string }> | null
  type: string | null
  virtual: boolean | null
  downloadable: boolean | null
  manage_stock: boolean | null
  backorders: string | null
  tax_status: string | null
  tax_class: string | null
  sale_start_date: string | null
  sale_end_date: string | null
  downloads: Array<{ id: string; name: string; file: string }> | null
  download_limit: number | null
  download_expiry: number | null
  tags: string | null
  full_description: string | null
  weight: string | null
  length: string | null
  width: string | null
  height: string | null
  shipping_class: string | null
  gtin: string | null
  sold_individually: boolean | null
  unit_of_measure: string | null
  upsell_ids: string[] | null
  cross_sell_ids: string[] | null
  purchase_note: string | null
  menu_order: number | null
  reviews_enabled: boolean | null
  pos_available: boolean | null
  created_at: string
  updated_at: string
}

export type PosSaleRow = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  subtotal: number
  discount: number
  tax: number
  total: number
  payment_method: string
  payment_method_title: string
  cashier_name: string
  status: string
  created_at: string
}

export type PosSaleItemRow = {
  id: string
  sale_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
}

/* ---------------- mappers ---------------- */

function extractImageSrc(r: ProductRow): string {
  // Prefer the text column (reliable for large data URLs), then fall back to
  // the JSONB images array. Checking images first caused Base64 data URLs to
  // not render in the product list after save.
  if (r.image_url && r.image_url.trim()) return r.image_url.trim()
  const imgs = r.images
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0]
    if (first && typeof first === 'object' && typeof first.src === 'string' && first.src.trim()) return first.src.trim()
  }
  if (typeof imgs === 'string' && imgs.trim()) {
    // The column is jsonb now, but older rows or stringified inserts may have
    // left a JSON string like '[]' or '[{"src":"..."}]'. Parse it so a valid
    // image URL is not mistaken for a raw (broken) <img src>.
    try {
      const parsed = JSON.parse(imgs)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0]
        if (typeof first === 'string' && first.trim()) return first.trim()
        if (first && typeof first === 'object' && typeof first.src === 'string' && first.src.trim()) return first.src.trim()
      }
    } catch {
      // not JSON — treat as a plain URL only if it looks like one
      if (/^(https?:|data:)/i.test(imgs.trim())) return imgs.trim()
    }
  }
  return ''
}

function extractGalleryImages(r: ProductRow): string[] {
  const g = r.gallery_images
  if (Array.isArray(g)) {
    return g
      .map((img: unknown): string => {
        if (typeof img === 'string') return img
        if (img && typeof img === 'object' && typeof (img as { src?: unknown }).src === 'string') return (img as { src: string }).src
        return ''
      })
      .filter((s: string) => s.trim() !== '')
  }
  if (typeof g === 'string' && g.trim()) {
    try {
      const parsed = JSON.parse(g)
      if (Array.isArray(parsed)) {
        return parsed
          .map((img: unknown): string =>
            typeof img === 'string' ? img : (img as { src?: string })?.src ?? ''
          )
          .filter((s: string) => s.trim() !== '')
      }
    } catch {
      return [g]
    }
  }
  return []
}

function extractCategory(r: ProductRow): string {
  if (typeof r.categories === 'string' && r.categories.trim()) return r.categories
  if (Array.isArray(r.categories) && r.categories.length > 0 && typeof r.categories[0]?.name === 'string') {
    return r.categories[0].name
  }
  return r.category || 'Uncategorized'
}

function mapProductRow(r: ProductRow): Product {
  const price = Number(r.regular_price) || 0
  const sale = r.sale_price !== null && r.sale_price !== undefined ? Number(r.sale_price) : null
  const stockQty = Number(r.stock_quantity) || 0
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    category: extractCategory(r),
    price,
    salePrice: sale,
    stock: stockQty,
    unitsSold: 0,
    image: '📦',
    imageUrl: extractImageSrc(r),
    galleryImages: extractGalleryImages(r),
    description: r.description ?? '',
    type: (r.type === 'variable' || (r.variations && Array.isArray(r.variations) && r.variations.length > 0)) ? 'variable' : 'simple',
    virtual: r.virtual ?? false,
    downloadable: r.downloadable ?? false,
    manageStock: r.manage_stock ?? true,
    stockStatus: (r.stock_status === 'instock' || r.stock_status === 'outofstock')
      ? (r.stock_status as 'instock' | 'outofstock')
      : (stockQty > 0 ? 'instock' : 'outofstock'),
    backorders: (['no', 'notify', 'yes'].includes(r.backorders ?? '') ? (r.backorders as Backorders) : 'no'),
    soldIndividually: r.sold_individually ?? false,
    unitOfMeasure: r.unit_of_measure ?? '',
    taxStatus: (r.tax_status === 'taxable' || r.tax_status === 'none') ? (r.tax_status as TaxStatus) : 'taxable',
    taxClass: r.tax_class ?? '',
    saleStartDate: r.sale_start_date ?? '',
    saleEndDate: r.sale_end_date ?? '',
    downloads: Array.isArray(r.downloads) ? r.downloads : [],
    downloadLimit: r.download_limit ?? 0,
    downloadExpiry: r.download_expiry ?? 0,
    attributes: Array.isArray(r.attributes) ? r.attributes : [],
    variations: Array.isArray(r.variations)
      ? r.variations.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          salePrice: v.salePrice,
          stockStatus: (v.stockStatus === 'instock' || v.stockStatus === 'outofstock') ? v.stockStatus : 'instock' as const,
          attributes: v.attributes,
          imageUrl: v.imageUrl ?? '',
          weight: v.weight ?? '',
        }))
      : [],
    tags: r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    fullDescription: r.full_description ?? '',
    weight: r.weight ?? '',
    length: r.length ?? '',
    width: r.width ?? '',
    height: r.height ?? '',
    shippingClass: r.shipping_class ?? '',
    gtin: r.gtin ?? '',
    upsellIds: Array.isArray(r.upsell_ids) ? r.upsell_ids : [],
    crossSellIds: Array.isArray(r.cross_sell_ids) ? r.cross_sell_ids : [],
    purchaseNote: r.purchase_note ?? '',
    menuOrder: r.menu_order ?? 0,
    reviewsEnabled: r.reviews_enabled ?? true,
    posAvailable: r.pos_available ?? true,
  }
}

function mapSaleToOrder(sale: PosSaleRow, items: PosSaleItemRow[]): Order {
  const lineItems: OrderLineItem[] = items.map((it) => ({
    productId: it.product_id ?? it.id,
    name: it.product_name,
    thumbnail: '📦',
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unit_price) || 0,
  }))
  const status = (['Processing', 'Completed', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery'].includes(sale.status)
    ? sale.status
    : 'Completed') as OrderStatus
  return {
    id: `#${sale.order_number}`,
    customer: sale.customer_name || 'Walk-in Customer',
    customerId: '',
    email: '',
    phone: sale.customer_phone || '',
    billingAddress: 'POS Counter',
    shippingAddress: 'POS Counter',
    items: lineItems.length,
    total: Number(sale.total) || 0,
    payment: sale.status === 'Cancelled' ? 'Refunded' : 'Paid',
    paymentMethod: sale.payment_method_title || 'Cash',
    transactionId: sale.id.slice(0, 8),
    date: new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status,
    lineItems,
  }
}

/* ---------------- products CRUD ---------------- */

export async function fetchStandaloneProducts(): Promise<Product[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as ProductRow[]).map(mapProductRow)
}

export type StandaloneProductInput = {
  name: string
  sku: string
  gtin?: string
  category: string
  regularPrice: number
  salePrice: number | null
  stockQuantity: number
  manageStock?: boolean
  stockStatus?: 'instock' | 'outofstock'
  backorders?: Backorders
  soldIndividually?: boolean
  unitOfMeasure?: string
  taxStatus?: TaxStatus
  taxClass?: string
  saleStartDate?: string
  saleEndDate?: string
  imageUrl: string
  galleryImages?: string[]
  description: string
  fullDescription?: string
  type?: 'simple' | 'variable'
  virtual?: boolean
  downloadable?: boolean
  downloads?: Array<{ id: string; name: string; file: string }>
  downloadLimit?: number
  downloadExpiry?: number
  attributes?: Array<{ id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }>
  variations?: Array<{ id: string; sku: string; price: string; salePrice: string | null; stockStatus: 'instock' | 'outofstock'; attributes: Array<{ name: string; option: string }>; imageUrl: string; weight: string }>
  tags?: string[]
  weight?: string
  length?: string
  width?: string
  height?: string
  shippingClass?: string
  upsellIds?: string[]
  crossSellIds?: string[]
  purchaseNote?: string
  menuOrder?: number
  reviewsEnabled?: boolean
  posAvailable?: boolean
}

export async function createStandaloneProduct(input: StandaloneProductInput): Promise<Product> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected. Connect Supabase in Settings first.')
  const row = {
    name: input.name.trim(),
    sku: input.sku.trim(),
    gtin: (input.gtin ?? '').trim(),
    category: input.category.trim() || 'Uncategorized',
    categories: input.category.trim() || 'Uncategorized',
    regular_price: input.regularPrice,
    sale_price: input.salePrice,
    stock_quantity: input.stockQuantity,
    stock_status: input.stockStatus ?? (input.stockQuantity > 0 ? 'instock' : 'outofstock'),
    image_url: input.imageUrl.trim() || null,
    images: input.imageUrl.trim() ? [{ src: input.imageUrl.trim() }] : [],
    gallery_images: (input.galleryImages ?? []).map((src) => ({ src })),
    description: input.description.trim(),
    full_description: (input.fullDescription ?? '').trim(),
    type: input.type ?? 'simple',
    virtual: input.virtual ?? false,
    downloadable: input.downloadable ?? false,
    manage_stock: input.manageStock ?? true,
    backorders: input.backorders ?? 'no',
    sold_individually: input.soldIndividually ?? false,
    unit_of_measure: (input.unitOfMeasure ?? '').trim(),
    tax_status: input.taxStatus ?? 'taxable',
    tax_class: (input.taxClass ?? '').trim(),
    sale_start_date: input.saleStartDate || null,
    sale_end_date: input.saleEndDate || null,
    downloads: input.downloadable ? (input.downloads ?? []) : [],
    download_limit: input.downloadable ? (input.downloadLimit ?? 0) : 0,
    download_expiry: input.downloadable ? (input.downloadExpiry ?? 0) : 0,
    attributes: input.attributes ?? [],
    variations: input.variations ?? [],
    tags: (input.tags ?? []).join(', '),
    weight: (input.weight ?? '').trim(),
    length: (input.length ?? '').trim(),
    width: (input.width ?? '').trim(),
    height: (input.height ?? '').trim(),
    shipping_class: (input.shippingClass ?? '').trim(),
    upsell_ids: input.upsellIds ?? [],
    cross_sell_ids: input.crossSellIds ?? [],
    purchase_note: (input.purchaseNote ?? '').trim(),
    menu_order: input.menuOrder ?? 0,
    reviews_enabled: input.reviewsEnabled ?? true,
    pos_available: input.posAvailable ?? true,
  }
  const { data, error } = await sb.from('products').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return mapProductRow(data as ProductRow)
}

export async function updateStandaloneProduct(id: string, input: Partial<StandaloneProductInput>): Promise<Product> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.sku !== undefined) patch.sku = input.sku.trim()
  if (input.gtin !== undefined) patch.gtin = input.gtin.trim()
  if (input.category !== undefined) {
    const cat = input.category.trim() || 'Uncategorized'
    patch.category = cat
    patch.categories = cat
  }
  if (input.regularPrice !== undefined) patch.regular_price = input.regularPrice
  if (input.salePrice !== undefined) patch.sale_price = input.salePrice
  if (input.stockQuantity !== undefined) {
    patch.stock_quantity = input.stockQuantity
    patch.stock_status = input.stockStatus ?? (input.stockQuantity > 0 ? 'instock' : 'outofstock')
  } else if (input.stockStatus !== undefined) {
    patch.stock_status = input.stockStatus
  }
  if (input.imageUrl !== undefined) {
    const url = input.imageUrl.trim()
    patch.image_url = url || null
    patch.images = url ? [{ src: url }] : []
  }
  if (input.galleryImages !== undefined) {
    patch.gallery_images = input.galleryImages.map((src) => ({ src }))
  }
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.fullDescription !== undefined) patch.full_description = input.fullDescription.trim()
  if (input.type !== undefined) patch.type = input.type
  if (input.virtual !== undefined) patch.virtual = input.virtual
  if (input.downloadable !== undefined) patch.downloadable = input.downloadable
  if (input.manageStock !== undefined) patch.manage_stock = input.manageStock
  if (input.backorders !== undefined) patch.backorders = input.backorders
  if (input.soldIndividually !== undefined) patch.sold_individually = input.soldIndividually
  if (input.unitOfMeasure !== undefined) patch.unit_of_measure = input.unitOfMeasure.trim()
  if (input.taxStatus !== undefined) patch.tax_status = input.taxStatus
  if (input.taxClass !== undefined) patch.tax_class = input.taxClass.trim()
  if (input.saleStartDate !== undefined) patch.sale_start_date = input.saleStartDate || null
  if (input.saleEndDate !== undefined) patch.sale_end_date = input.saleEndDate || null
  if (input.downloads !== undefined) patch.downloads = input.downloads
  if (input.downloadLimit !== undefined) patch.download_limit = input.downloadLimit
  if (input.downloadExpiry !== undefined) patch.download_expiry = input.downloadExpiry
  if (input.attributes !== undefined) patch.attributes = input.attributes
  if (input.variations !== undefined) patch.variations = input.variations
  if (input.tags !== undefined) patch.tags = input.tags.join(', ')
  if (input.weight !== undefined) patch.weight = input.weight.trim()
  if (input.length !== undefined) patch.length = input.length.trim()
  if (input.width !== undefined) patch.width = input.width.trim()
  if (input.height !== undefined) patch.height = input.height.trim()
  if (input.shippingClass !== undefined) patch.shipping_class = input.shippingClass.trim()
  if (input.upsellIds !== undefined) patch.upsell_ids = input.upsellIds
  if (input.crossSellIds !== undefined) patch.cross_sell_ids = input.crossSellIds
  if (input.purchaseNote !== undefined) patch.purchase_note = input.purchaseNote.trim()
  if (input.menuOrder !== undefined) patch.menu_order = input.menuOrder
  if (input.reviewsEnabled !== undefined) patch.reviews_enabled = input.reviewsEnabled
  if (input.posAvailable !== undefined) patch.pos_available = input.posAvailable
  const { data, error } = await sb.from('products').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return mapProductRow(data as ProductRow)
}

export async function deleteStandaloneProduct(id: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateStandaloneProductStock(id: string, newStock: number): Promise<Product> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')
  const { data, error } = await sb
    .from('products')
    .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapProductRow(data as ProductRow)
}

/* ---------------- POS sales (checkout) ---------------- */

export type StandaloneCheckoutInput = {
  lines: Array<{ productId: string; variationId: string | null; name: string; price: number; quantity: number }>
  customerName: string
  customerPhone: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  paymentMethodTitle: string
  cashierName: string
}

export type StandaloneCheckoutResult = {
  orderId: string
  orderNumber: string
  total: number
  date: string
}

function generateOrderNumber(): string {
  return `POS-${Date.now().toString().slice(-6)}`
}

export async function createStandaloneSale(input: StandaloneCheckoutInput): Promise<StandaloneCheckoutResult> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected. Connect Supabase in Settings first.')

  const orderNumber = generateOrderNumber()
  const saleRow = {
    order_number: orderNumber,
    customer_name: input.customerName || 'Walk-in Customer',
    customer_phone: input.customerPhone || '',
    subtotal: input.subtotal,
    discount: input.discount,
    tax: input.tax,
    total: input.total,
    payment_method: input.paymentMethod,
    payment_method_title: input.paymentMethodTitle,
    cashier_name: input.cashierName,
    status: 'Completed',
  }

  const { data: saleData, error: saleErr } = await sb.from('pos_sales').insert(saleRow).select('*').single()
  if (saleErr || !saleData) throw new Error(saleErr?.message ?? 'Failed to record sale.')

  const sale = saleData as PosSaleRow

  // Variation cart lines use a composite key "parentId-variationId" for dedup.
  // Extract the real product UUID for the database; set product_id to null for variation lines
  // since pos_sale_items.product_id is a UUID FK to products, and variation IDs aren't product rows.
  const itemRows = input.lines.map((l) => ({
    sale_id: sale.id,
    product_id: l.variationId ? null : l.productId,
    product_name: l.name,
    quantity: l.quantity,
    unit_price: l.price,
  }))
  if (itemRows.length > 0) {
    const { error: itemsErr } = await sb.from('pos_sale_items').insert(itemRows)
    if (itemsErr) throw new Error(itemsErr.message)
  }

  // Deduct stock for each line (skip variation lines — stock is tracked per variation, not product row)
  for (const l of input.lines) {
    if (l.variationId) continue
    try {
      // Read current stock then update — single-tenant, low concurrency is acceptable here.
      const { data: prod } = await sb.from('products').select('stock_quantity').eq('id', l.productId).maybeSingle()
      const current = (prod as { stock_quantity?: number } | null)?.stock_quantity ?? 0
      const nextStock = Math.max(0, current - l.quantity)
      await sb.from('products').update({ stock_quantity: nextStock, updated_at: new Date().toISOString() }).eq('id', l.productId)
    } catch {
      // stock deduction failure should not fail the sale
    }
  }

  return {
    orderId: `#${orderNumber}`,
    orderNumber,
    total: input.total,
    date: new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}

/* ---------------- sales -> orders (for Orders/Dashboard/Reports) ---------------- */

export async function fetchStandaloneOrders(limit = 100): Promise<Order[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data: sales, error } = await sb
    .from('pos_sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  if (!sales || sales.length === 0) return []

  const saleRows = sales as PosSaleRow[]
  const saleIds = saleRows.map((s) => s.id)
  const { data: itemsData } = await sb.from('pos_sale_items').select('*').in('sale_id', saleIds)
  const itemsBySale = new Map<string, PosSaleItemRow[]>()
  for (const it of (itemsData as PosSaleItemRow[]) ?? []) {
    const arr = itemsBySale.get(it.sale_id) ?? []
    arr.push(it)
    itemsBySale.set(it.sale_id, arr)
  }

  return saleRows.map((s) => mapSaleToOrder(s, itemsBySale.get(s.id) ?? []))
}

/* ---------------- order status updates ---------------- */

export async function updateStandaloneOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const orderNumber = orderId.replace(/^#/, '')

  // Update pos_sales (POS-created orders)
  const { error: posErr } = await sb
    .from('pos_sales')
    .update({ status })
    .eq('order_number', orderNumber)
  if (posErr) throw new Error(posErr.message)

  // Also update orders table if a matching row exists (WooCommerce-synced or duplicated orders)
  const { error: ordersErr } = await sb
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('order_number', orderNumber)
  if (ordersErr) throw new Error(ordersErr.message)
}

/* ---------------- deliveries sync ---------------- */

export type DeliveryRecord = {
  orderNumber: string
  courier: string
  awb: string
  trackingUrl: string
  estimatedDelivery: string
  shippedAt: string
  deliveryStatus?: string
  staffId?: string | null
  staffName?: string | null
  signature?: string | null
  completedAt?: string | null
}

async function resolveOrderId(orderNumber: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = await sb
    .from('pos_sales')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (data) return (data as { id: string }).id
  const { data: orderData } = await sb
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle()
  return orderData ? (orderData as { id: string }).id : null
}

export async function upsertDelivery(record: DeliveryRecord): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const orderId = await resolveOrderId(record.orderNumber)
  const nowIso = new Date().toISOString()
  const row = {
    order_id: orderId,
    order_number: record.orderNumber,
    courier: record.courier,
    awb: record.awb,
    tracking_url: record.trackingUrl || null,
    estimated_delivery: record.estimatedDelivery || null,
    shipped_at: record.shippedAt,
    delivery_status: record.deliveryStatus ?? 'shipped',
    staff_id: record.staffId ?? null,
    staff_name: record.staffName ?? null,
    signature: record.signature ?? null,
    completed_at: record.completedAt ?? null,
    updated_at: nowIso,
  }

  // Check if a delivery row already exists for this order number
  const { data: existing, error: selectErr } = await sb
    .from('deliveries')
    .select('id')
    .eq('order_number', record.orderNumber)
    .maybeSingle()

  if (selectErr) throw new Error(selectErr.message)

  if (existing) {
    const { error: updateErr } = await sb
      .from('deliveries')
      .update(row)
      .eq('id', (existing as { id: string }).id)
    if (updateErr) throw new Error(updateErr.message)
  } else {
    const { error: insertErr } = await sb
      .from('deliveries')
      .insert(row)
    if (insertErr) throw new Error(insertErr.message)
  }
}

export async function fetchDeliveryByOrderNumber(orderNumber: string): Promise<DeliveryRecord | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('deliveries')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (error || !data) return null
  const r = data as Record<string, string | null>
  return {
    orderNumber: r.order_number as string,
    courier: r.courier as string,
    awb: r.awb as string,
    trackingUrl: r.tracking_url ?? '',
    estimatedDelivery: r.estimated_delivery ?? '',
    shippedAt: r.shipped_at as string,
    deliveryStatus: r.delivery_status as string,
    staffId: r.staff_id,
    staffName: r.staff_name,
    signature: r.signature,
    completedAt: r.completed_at,
  }
}
