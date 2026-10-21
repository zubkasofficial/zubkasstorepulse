import { getSupabase } from '@/lib/supabase'
import type { Product, Order, OrderStatus, OrderLineItem } from '@/data/mockData'

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
  description: string | null
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
  const imgs = r.images
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && typeof first.src === 'string') return first.src
  }
  if (typeof imgs === 'string' && imgs.trim()) return imgs
  return r.image_url ?? ''
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
    description: r.description ?? '',
    fullDescription: r.description ?? '',
    type: 'simple',
    virtual: false,
    downloadable: false,
    manageStock: true,
    stockStatus: (r.stock_status === 'instock' || r.stock_status === 'outofstock')
      ? (r.stock_status as 'instock' | 'outofstock')
      : (stockQty > 0 ? 'instock' : 'outofstock'),
    backorders: 'no',
    taxStatus: 'taxable',
    taxClass: '',
    saleStartDate: '',
    saleEndDate: '',
    downloads: [],
    downloadLimit: 0,
    downloadExpiry: 0,
    attributes: [],
    variations: [],
    tags: [],
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
  category: string
  regularPrice: number
  salePrice: number | null
  stockQuantity: number
  imageUrl: string
  description: string
}

export async function createStandaloneProduct(input: StandaloneProductInput): Promise<Product> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected. Connect Supabase in Settings first.')
  const row = {
    name: input.name.trim(),
    sku: input.sku.trim(),
    category: input.category.trim() || 'Uncategorized',
    categories: input.category.trim() || 'Uncategorized',
    regular_price: input.regularPrice,
    sale_price: input.salePrice,
    stock_quantity: input.stockQuantity,
    stock_status: input.stockQuantity > 0 ? 'instock' : 'outofstock',
    image_url: input.imageUrl.trim() || null,
    images: input.imageUrl.trim() ? [{ src: input.imageUrl.trim() }] : [],
    description: input.description.trim(),
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
  if (input.category !== undefined) {
    const cat = input.category.trim() || 'Uncategorized'
    patch.category = cat
    patch.categories = cat
  }
  if (input.regularPrice !== undefined) patch.regular_price = input.regularPrice
  if (input.salePrice !== undefined) patch.sale_price = input.salePrice
  if (input.stockQuantity !== undefined) {
    patch.stock_quantity = input.stockQuantity
    patch.stock_status = input.stockQuantity > 0 ? 'instock' : 'outofstock'
  }
  if (input.imageUrl !== undefined) {
    const url = input.imageUrl.trim()
    patch.image_url = url || null
    patch.images = url ? [{ src: url }] : []
  }
  if (input.description !== undefined) patch.description = input.description.trim()
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
  lines: Array<{ productId: string; name: string; price: number; quantity: number }>
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
  const itemRows = input.lines.map((l) => ({
    sale_id: sale.id,
    product_id: l.productId,
    product_name: l.name,
    quantity: l.quantity,
    unit_price: l.price,
  }))
  if (itemRows.length > 0) {
    const { error: itemsErr } = await sb.from('pos_sale_items').insert(itemRows)
    if (itemsErr) throw new Error(itemsErr.message)
  }

  // Deduct stock for each line
  for (const l of input.lines) {
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
