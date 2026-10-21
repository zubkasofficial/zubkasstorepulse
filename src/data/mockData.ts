export type OrderStatus = 'Processing' | 'Completed' | 'On Hold' | 'Cancelled' | 'Refunded' | 'Shipped' | 'Out for Delivery'

export const STATUS_BADGE: Record<OrderStatus, string> = {
  Processing: 'bg-blue-50 text-blue-700',
  Completed: 'bg-green-50 text-green-700',
  'On Hold': 'bg-amber-50 text-amber-700',
  Cancelled: 'bg-red-50 text-red-700',
  Refunded: 'bg-slate-100 text-slate-600',
  Shipped: 'bg-indigo-50 text-indigo-700',
  'Out for Delivery': 'bg-purple-50 text-purple-700',
}

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)

export type OrderLineItem = {
  productId: string
  name: string
  thumbnail: string
  quantity: number
  unitPrice: number
}

export type Order = {
  id: string
  customer: string
  customerId: string
  email: string
  phone: string
  billingAddress: string
  shippingAddress: string
  items: number
  total: number
  payment: 'Paid' | 'Pending' | 'Refunded'
  paymentMethod: string
  transactionId: string
  date: string
  status: OrderStatus
  lineItems: OrderLineItem[]
}

export type ProductType = 'simple' | 'variable'
export type TaxStatus = 'taxable' | 'none'
export type Backorders = 'no' | 'notify' | 'yes'

export type DownloadableFile = {
  id: string
  name: string
  file: string
}

export type ProductAttribute = {
  id: number
  name: string
  position: number
  visible: boolean
  variation: boolean
  options: string[]
}

export type ProductVariation = {
  id: string
  sku: string
  price: string
  salePrice: string | null
  attributes: Array<{ name: string; option: string }>
}

export type Product = {
  id: string
  name: string
  sku: string
  category: string
  price: number
  salePrice: number | null
  stock: number
  unitsSold: number
  image: string
  imageUrl: string
  description: string
  type: ProductType
  virtual: boolean
  downloadable: boolean
  manageStock: boolean
  stockStatus: 'instock' | 'outofstock'
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

export const PRODUCT_CATEGORIES = ['Electronics', 'Wearables', 'Home & Living', 'Accessories']

export type Customer = {
  id: string
  name: string
  email: string
  location: string
  orders: number
  spent: number
  joined: string
}

/* ---------------- Reports types ---------------- */

export type DateRangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'ytd' | 'custom'

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  this_month: 'This Month',
  last_month: 'Last Month',
  ytd: 'This Year',
  custom: 'Custom Range',
}

