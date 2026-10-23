import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Search, Plus, Minus, Trash2, X, User, Phone, Calculator, Wallet, CreditCard, QrCode, Printer, CircleCheck as CheckCircle2, ShoppingBag, Package, Percent, IndianRupee, RefreshCw, Receipt as ReceiptIcon, Ticket, Tag } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useWoo } from '@/auth/WooContext'
import { useAuth } from '@/auth/AuthContext'
import { createPosOrder, type CreatePosOrderInput, type CreatedPosOrder } from '@/lib/woocommerce'
import { createStandaloneSale } from '@/lib/standaloneDb'
import { formatCurrency, type Product, type Customer } from '@/data/mockData'
import ThermalReceiptModal from '@/components/ThermalReceiptModal'
import { printThermalReceipt, type ReceiptData, type RollSize } from '@/lib/thermalReceipt'
import { getSupabase } from '@/lib/supabase'
import { incrementCouponUsage } from '@/lib/coupons'

type Coupon = {
  id: string
  code: string
  discountType: 'percent' | 'flat'
  amount: number
  minimumAmount: number
  usageLimit: number
  usageCount: number
  dateExpires: string | null
}

async function fetchActiveCoupons(): Promise<Coupon[]> {
  const sb = getSupabase()
  if (!sb) return []
  try {
    const { data, error } = await sb
      .from('coupons')
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, is_active')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[pos] coupon fetch error:', error.message)
      return []
    }
    if (!data) return []
    return (data as Array<{ id: string; code: string; discount_type: string; amount: number; minimum_amount: number; usage_limit: number; usage_count: number; date_expires: string | null; is_active: boolean }>)
      .filter((r) => r.is_active !== false)
      .map((r) => ({
        id: r.id,
        code: r.code,
        discountType: r.discount_type === 'percent' ? 'percent' : 'flat',
        amount: Number(r.amount),
        minimumAmount: Number(r.minimum_amount),
        usageLimit: r.usage_limit,
        usageCount: r.usage_count,
        dateExpires: r.date_expires,
      }))
  } catch (err) {
    console.error('[pos] coupon fetch exception:', err instanceof Error ? err.message : err)
    return []
  }
}

async function fetchCouponByCode(code: string): Promise<Coupon | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('coupons')
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, is_active')
      .ilike('code', code)
      .maybeSingle()
    if (error) {
      console.error('[pos] coupon lookup error:', error.message)
      return null
    }
    if (!data) return null
    const r = data as { id: string; code: string; discount_type: string; amount: number; minimum_amount: number; usage_limit: number; usage_count: number; date_expires: string | null; is_active: boolean }
    if (r.is_active === false) return null
    return {
      id: r.id,
      code: r.code,
      discountType: r.discount_type === 'percent' ? 'percent' : 'flat',
      amount: Number(r.amount),
      minimumAmount: Number(r.minimum_amount),
      usageLimit: r.usage_limit,
      usageCount: r.usage_count,
      dateExpires: r.date_expires,
    }
  } catch (err) {
    console.error('[pos] coupon lookup exception:', err instanceof Error ? err.message : err)
    return null
  }
}

type CartLine = {
  productId: string
  name: string
  price: number
  quantity: number
}

type PaymentMethod = 'cash' | 'upi' | 'card'

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'cash', label: 'Cash', icon: Wallet },
  { key: 'upi', label: 'UPI / QR Code', icon: QrCode },
  { key: 'card', label: 'Card', icon: CreditCard },
]

const TAX_RATE = 0 // configurable; set to 0 for no tax by default

export default function PosPage() {
  const { products, loading, isLive, connection, refresh, pushToast, appMode, customers } = useWoo()
  const isStandalone = appMode === 'standalone' || !connection

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<CartLine[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // Customer
  const [customerMode, setCustomerMode] = useState<'walkin' | 'named'>('walkin')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 8)
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [customers, customerSearch])

  const selectCustomer = (c: typeof customers[number]) => {
    setCustomerName(c.name)
    setCustomerPhone(c.phone)
    setCustomerSearch('')
    setShowCustomerDropdown(false)
  }

  // Discount
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat')
  const [discountValue, setDiscountValue] = useState('')

  // Coupon
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const couponsLoadedRef = useRef(false)

  useEffect(() => {
    if (couponsLoadedRef.current) return
    couponsLoadedRef.current = true
    fetchActiveCoupons().then(setCoupons).catch(() => {})
  }, [])

  useEffect(() => {
    const onFocus = () => {
      fetchActiveCoupons().then(setCoupons).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  // Thermal receipt settings
  const [rollSize, setRollSize] = useState<RollSize>('80mm')
  const [autoPrint, setAutoPrint] = useState(false)
  const [showThermalModal, setShowThermalModal] = useState(false)

  // Order completion
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<CreatedPosOrder | null>(null)
  const [receiptData, setReceiptData] = useState<{
    lines: CartLine[]
    subtotal: number
    discount: number
    tax: number
    total: number
    customerName: string
    customerPhone: string
    paymentMethod: PaymentMethod
  } | null>(null)

  const { user } = useAuth()

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category))
    return ['All', ...Array.from(cats)]
  }, [products])

  const cartItemCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return products.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      const matchesCat = category === 'All' || p.category === category
      return matchesQuery && matchesCat
    })
  }, [products, query, category])

  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + l.price * l.quantity, 0), [cart])

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0
    if (discountType === 'flat') return Math.min(val, subtotal)
    return Math.round((subtotal * Math.min(val, 100)) / 100)
  }, [discountValue, discountType, subtotal])

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim()
    if (!code) return
    const normalized = code.toLowerCase()
    let coupon: Coupon | undefined = coupons.find((c) => c.code.toLowerCase() === normalized)
    if (!coupon) {
      coupon = await fetchCouponByCode(code) ?? undefined
    }
    if (!coupon) {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: 'Invalid coupon code.' })
      return
    }
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: 'This coupon has reached its usage limit.' })
      return
    }
    if (coupon.dateExpires) {
      const expiry = new Date(coupon.dateExpires + 'T23:59:59')
      if (expiry < new Date()) {
        setAppliedCoupon(null)
        setCouponMessage({ type: 'error', text: 'This coupon has expired.' })
        return
      }
    }
    if (subtotal < coupon.minimumAmount) {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: `Minimum order amount ${formatCurrency(coupon.minimumAmount)} required.` })
      return
    }
    setAppliedCoupon(coupon)
    setCouponMessage({ type: 'success', text: `Coupon "${coupon.code}" applied!` })
  }, [couponInput, coupons, subtotal])

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMessage(null)
  }, [])

  const couponDiscount = useMemo(() => {
    if (!appliedCoupon || subtotal <= 0) return 0
    if (appliedCoupon.discountType === 'percent') {
      return Math.round((subtotal * Math.min(appliedCoupon.amount, 100)) / 100)
    }
    return Math.min(appliedCoupon.amount, subtotal)
  }, [appliedCoupon, subtotal])

  const totalDiscount = discountAmount + couponDiscount
  const taxableAmount = Math.max(subtotal - totalDiscount, 0)
  const tax = Math.round(taxableAmount * TAX_RATE)
  const total = taxableAmount + tax

  const addToCart = (product: Product) => {
    setFlashId(product.id)
    window.setTimeout(() => setFlashId((cur) => (cur === product.id ? null : cur)), 400)
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { productId: product.id, name: product.name, price: product.salePrice ?? product.price, quantity: 1 }]
    })
  }

  const incrementQty = (productId: string) => {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l)))
  }

  const decrementQty = (productId: string) => {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const clearCart = () => {
    setCart([])
    setDiscountValue('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerMode('walkin')
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMessage(null)
  }

  const handleCompleteOrder = async () => {
    if (cart.length === 0 || processing) return
    setProcessing(true)

    const orderData = {
      lines: cart,
      customerName: customerMode === 'named' ? customerName.trim() : 'Walk-in Customer',
      customerPhone: customerMode === 'named' ? customerPhone.trim() : '',
      subtotal,
      discount: totalDiscount,
      tax,
      total,
      paymentMethod,
      paymentMethodTitle: PAYMENT_METHODS.find((p) => p.key === paymentMethod)?.label ?? 'Cash',
    }

    try {
      let created: CreatedPosOrder
      if (connection && !isStandalone) {
        created = await createPosOrder(connection, orderData as CreatePosOrderInput)
      } else {
        const result = await createStandaloneSale({
          ...orderData,
          cashierName: user?.name ?? 'Cashier',
        })
        created = { id: result.orderId, number: result.orderNumber, total: result.total, date: result.date }
      }
      setReceipt(created)
      setReceiptData({ ...orderData, paymentMethod })
      pushToast('success', `Order ${created.id} completed and synced to Cloud!`)
      if (appliedCoupon) {
        incrementCouponUsage(appliedCoupon.code).catch(() => {})
      }
      refresh()
      if (autoPrint) {
        const thermalData: ReceiptData = {
          orderId: created.id,
          date: created.date,
          cashierName: user?.name ?? 'Cashier',
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          items: orderData.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.price })),
          subtotal: orderData.subtotal,
          discount: orderData.discount,
          tax: orderData.tax,
          deliveryFee: 0,
          total: orderData.total,
          paymentMethod: orderData.paymentMethodTitle ?? 'Cash',
        }
        printThermalReceipt(thermalData, rollSize)
      }
    } catch (err) {
      pushToast('error', `Failed to create order: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setProcessing(false)
      return
    }

    setProcessing(false)
    clearCart()
  }

  const buildThermalData = (): ReceiptData | null => {
    if (!receipt || !receiptData) return null
    return {
      orderId: receipt.id,
      date: receipt.date,
      cashierName: user?.name ?? 'Cashier',
      customerName: receiptData.customerName,
      customerPhone: receiptData.customerPhone,
      items: receiptData.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.price })),
      subtotal: receiptData.subtotal,
      discount: receiptData.discount,
      tax: receiptData.tax,
      deliveryFee: 0,
      total: receiptData.total,
      paymentMethod: PAYMENT_METHODS.find((p) => p.key === receiptData.paymentMethod)?.label ?? 'Cash',
    }
  }

  const handlePrintThermal = () => {
    const data = buildThermalData()
    if (!data) return
    printThermalReceipt(data, rollSize)
  }

  const handleShowThermalPreview = () => {
    setShowThermalModal(true)
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-brand">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">POS Terminal</h1>
              <p className="text-sm text-slate-500">Cloud billing — search, add to cart, and checkout in seconds.</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync Products
          </button>
        </div>



        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LEFT: Product Catalog */}
          <div className="lg:col-span-2">
            {/* Search */}
            <div className="mb-3 relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by product name or SKU…"
                className="input-field pl-10"
              />
            </div>

            {/* Category pills */}
            {categories.length > 1 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      category === c
                        ? 'bg-brand text-white shadow-brand'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => {
                  const outOfStock = p.stock <= 0
                  const flashing = flashId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={outOfStock}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${
                        outOfStock
                          ? 'border-slate-100 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 hover:border-brand/30 hover:shadow-md'
                      } ${flashing ? 'ring-2 ring-brand/40 animate-scale-in' : ''}`}
                    >
                      {/* Image */}
                      <div className="relative h-24 w-full overflow-hidden bg-slate-50">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">{p.image}</div>
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">Out of stock</span>
                          </div>
                        )}
                        {!outOfStock && (
                          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm">
                            {p.stock} left
                          </span>
                        )}
                        {flashing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-brand/10">
                            <CheckCircle2 className="h-8 w-8 text-brand" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{p.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">SKU: {p.sku}</p>
                        <div className="mt-auto pt-2">
                          <span className="font-display text-lg font-bold text-brand">
                            {formatCurrency(p.salePrice ?? p.price)}
                          </span>
                          {p.salePrice !== null && (
                            <span className="ml-1.5 text-xs text-slate-400 line-through">{formatCurrency(p.price)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <Package className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-400">
                  {isLive ? 'No products match your search.' : 'Add products in the Products page to start selling.'}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Cart & Checkout (desktop) */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Cart header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-brand" />
                  <h2 className="font-display text-lg font-bold text-slate-900">Current Order</h2>
                  {cart.length > 0 && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">
                      {cart.reduce((s, l) => s + l.quantity, 0)} items
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs font-medium text-slate-400 transition hover:text-red-500"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Cart lines */}
              <div className="max-h-[280px] overflow-y-auto px-5 py-3">
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    {cart.map((l) => (
                      <div key={l.productId} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                          <p className="text-xs text-slate-400">{formatCurrency(l.price)} each</p>
                        </div>
                        {/* Qty controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => decrementQty(l.productId)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold text-slate-900">{l.quantity}</span>
                          <button
                            onClick={() => incrementQty(l.productId)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="w-16 text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(l.price * l.quantity)}</p>
                        </div>
                        <button
                          onClick={() => removeLine(l.productId)}
                          className="rounded-lg p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ShoppingBag className="h-10 w-10 text-slate-200" />
                    <p className="mt-3 text-sm text-slate-400">Cart is empty. Click a product to add it.</p>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {/* Customer selector */}
                  <div>
                    <div className="mb-2 flex gap-2">
                      <button
                        onClick={() => setCustomerMode('walkin')}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          customerMode === 'walkin'
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        Walk-in Customer
                      </button>
                      <button
                        onClick={() => setCustomerMode('named')}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          customerMode === 'named'
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        Named Customer
                      </button>
                    </div>
                    {customerMode === 'named' && (
                      <CustomerPicker
                        customers={customers}
                        filteredCustomers={filteredCustomers}
                        customerSearch={customerSearch}
                        setCustomerSearch={setCustomerSearch}
                        showDropdown={showCustomerDropdown}
                        setShowDropdown={setShowCustomerDropdown}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        customerPhone={customerPhone}
                        setCustomerPhone={setCustomerPhone}
                        onSelect={selectCustomer}
                      />
                    )}
                  </div>

                  {/* Discount */}
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        onClick={() => setDiscountType('flat')}
                        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          discountType === 'flat'
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <IndianRupee className="h-3 w-3" /> Flat
                      </button>
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          discountType === 'percent'
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <Percent className="h-3 w-3" /> Percent
                      </button>
                      <input
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Coupon */}
                  <CouponInput
                    couponInput={couponInput}
                    setCouponInput={setCouponInput}
                    appliedCoupon={appliedCoupon}
                    couponMessage={couponMessage}
                    onApply={applyCoupon}
                    onRemove={removeCoupon}
                  />

                  {/* Summary */}
                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Coupon ({appliedCoupon?.code})</span>
                        <span className="font-medium">-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Tax</span>
                        <span className="font-medium text-slate-700">{formatCurrency(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="font-display font-bold text-slate-900">Total Payable</span>
                      <span className="font-display text-xl font-bold text-brand">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {/* Payment methods */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_METHODS.map((m) => {
                        const active = paymentMethod === m.key
                        return (
                          <button
                            key={m.key}
                            onClick={() => setPaymentMethod(m.key)}
                            className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition ${
                              active
                                ? 'border-brand bg-brand-50 text-brand shadow-sm'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <m.icon className="h-4 w-4" />
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Thermal receipt settings */}
                  <div className="space-y-2 rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Receipt Roll Size</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setRollSize('58mm')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            rollSize === '58mm'
                              ? 'bg-[#9f0f0f] text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          58mm
                        </button>
                        <button
                          onClick={() => setRollSize('80mm')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            rollSize === '80mm'
                              ? 'bg-[#9f0f0f] text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          80mm
                        </button>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Auto-print receipt after checkout</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoPrint}
                        onClick={() => setAutoPrint((v) => !v)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                          autoPrint ? 'bg-[#9f0f0f]' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${autoPrint ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  </div>

                  {/* Complete order button */}
                  <button
                    onClick={handleCompleteOrder}
                    disabled={processing || cart.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#9f0f0f]/30 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" /> Processing…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" /> Complete Order &amp; Print Receipt
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile cart FAB */}
      {cartItemCount > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-[#9f0f0f] px-5 py-3.5 text-white shadow-lg shadow-[#9f0f0f]/40 transition hover:bg-[#880d0d] active:scale-95 lg:hidden"
        >
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-[#9f0f0f]">
            {cartItemCount}
          </span>
          <span className="text-sm font-semibold">View Cart</span>
          <span className="text-sm font-bold">{formatCurrency(total)}</span>
        </button>
      )}

      {/* Mobile cart bottom sheet */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-slide-up">
            {/* Drag handle */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-brand" />
                <h2 className="font-display text-lg font-bold text-slate-900">Current Order</h2>
                {cart.length > 0 && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">
                    {cartItemCount} items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs font-medium text-slate-400 transition hover:text-red-500"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setMobileCartOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Close cart"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Cart lines */}
            <div className="px-5 py-3">
              {cart.length > 0 ? (
                <div className="space-y-2">
                  {cart.map((l) => (
                    <div key={l.productId} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(l.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => decrementQty(l.productId)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-slate-900">{l.quantity}</span>
                        <button
                          onClick={() => incrementQty(l.productId)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="w-16 text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(l.price * l.quantity)}</p>
                      </div>
                      <button
                        onClick={() => removeLine(l.productId)}
                        className="rounded-lg p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingBag className="h-10 w-10 text-slate-200" />
                  <p className="mt-3 text-sm text-slate-400">Cart is empty. Click a product to add it.</p>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                {/* Customer selector */}
                <div>
                  <div className="mb-2 flex gap-2">
                    <button
                      onClick={() => setCustomerMode('walkin')}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        customerMode === 'walkin'
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Walk-in Customer
                    </button>
                    <button
                      onClick={() => setCustomerMode('named')}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        customerMode === 'named'
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Named Customer
                    </button>
                  </div>
                  {customerMode === 'named' && (
                    <CustomerPicker
                      customers={customers}
                      filteredCustomers={filteredCustomers}
                      customerSearch={customerSearch}
                      setCustomerSearch={setCustomerSearch}
                      showDropdown={showCustomerDropdown}
                      setShowDropdown={setShowCustomerDropdown}
                      customerName={customerName}
                      setCustomerName={setCustomerName}
                      customerPhone={customerPhone}
                      setCustomerPhone={setCustomerPhone}
                      onSelect={selectCustomer}
                    />
                  )}
                </div>

                {/* Discount */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={() => setDiscountType('flat')}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        discountType === 'flat'
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <IndianRupee className="h-3 w-3" /> Flat
                    </button>
                    <button
                      onClick={() => setDiscountType('percent')}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        discountType === 'percent'
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <Percent className="h-3 w-3" /> Percent
                    </button>
                    <input
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Coupon */}
                <CouponInput
                  couponInput={couponInput}
                  setCouponInput={setCouponInput}
                  appliedCoupon={appliedCoupon}
                  couponMessage={couponMessage}
                  onApply={applyCoupon}
                  onRemove={removeCoupon}
                />

                {/* Summary */}
                <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon ({appliedCoupon?.code})</span>
                      <span className="font-medium">-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Tax</span>
                      <span className="font-medium text-slate-700">{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-display font-bold text-slate-900">Total Payable</span>
                    <span className="font-display text-xl font-bold text-brand">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment methods */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const active = paymentMethod === m.key
                      return (
                        <button
                          key={m.key}
                          onClick={() => setPaymentMethod(m.key)}
                          className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition ${
                            active
                              ? 'border-brand bg-brand-50 text-brand shadow-sm'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <m.icon className="h-4 w-4" />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Complete order button */}
                <button
                  onClick={() => { handleCompleteOrder(); }}
                  disabled={processing || cart.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#9f0f0f]/30 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Complete Order &amp; Print Receipt
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && receiptData && (
        <ReceiptModal
          order={receipt}
          data={receiptData}
          onClose={() => { setReceipt(null); setReceiptData(null) }}
          onPrintThermal={handlePrintThermal}
          onPreviewThermal={handleShowThermalPreview}
        />
      )}

      {showThermalModal && (
        <ThermalReceiptModal
          open={showThermalModal}
          data={buildThermalData()}
          defaultRoll={rollSize}
          onClose={() => setShowThermalModal(false)}
        />
      )}
    </AppLayout>
  )
}

/* ---------------- Coupon Input ---------------- */

function CouponInput({
  couponInput,
  setCouponInput,
  appliedCoupon,
  couponMessage,
  onApply,
  onRemove,
}: {
  couponInput: string
  setCouponInput: (v: string) => void
  appliedCoupon: Coupon | null
  couponMessage: { type: 'success' | 'error'; text: string } | null
  onApply: () => void
  onRemove: () => void
}) {
  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 animate-fade-in">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-700">{appliedCoupon.code}</p>
            <p className="text-xs text-green-600">
              {appliedCoupon.discountType === 'percent'
                ? `${appliedCoupon.amount}% off`
                : `${formatCurrency(appliedCoupon.amount)} off`}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-100"
          aria-label="Remove coupon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onApply() } }}
            placeholder="Coupon code"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </div>
        <button
          onClick={onApply}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 active:scale-95"
        >
          Apply
        </button>
      </div>
      {couponMessage && (
        <p className={`text-xs ${couponMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {couponMessage.text}
        </p>
      )}
    </div>
  )
}

/* ---------------- Customer Picker (searchable dropdown) ---------------- */

function CustomerPicker({
  customers,
  filteredCustomers,
  customerSearch,
  setCustomerSearch,
  showDropdown,
  setShowDropdown,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  onSelect,
}: {
  customers: Customer[]
  filteredCustomers: Customer[]
  customerSearch: string
  setCustomerSearch: (v: string) => void
  showDropdown: boolean
  setShowDropdown: (v: boolean) => void
  customerName: string
  setCustomerName: (v: string) => void
  customerPhone: string
  setCustomerPhone: (v: string) => void
  onSelect: (c: Customer) => void
}) {
  return (
    <div className="space-y-2 animate-fade-in">
      {/* Searchable customer dropdown */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={customerSearch}
          onChange={(e) => {
            setCustomerSearch(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search existing customers by name, phone, or email…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
        />
        {showDropdown && filteredCustomers.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(c)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-brand-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
                  {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {c.phone || 'No phone'} · {c.email || 'No email'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {showDropdown && customerSearch.trim() && filteredCustomers.length === 0 && customers.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
            No matching customers found. Fill in the details below manually.
          </div>
        )}
        {showDropdown && customers.length === 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
            No customers yet. Add some from the Customers page.
          </div>
        )}
      </div>

      {/* Manual name + phone fields (auto-filled on selection, editable) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </div>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Receipt Modal ---------------- */

function ReceiptModal({
  order,
  data,
  onClose,
  onPrintThermal,
  onPreviewThermal,
}: {
  order: CreatedPosOrder
  data: {
    lines: CartLine[]
    subtotal: number
    discount: number
    tax: number
    total: number
    customerName: string
    customerPhone: string
    paymentMethod: PaymentMethod
  }
  onClose: () => void
  onPrintThermal: () => void
  onPreviewThermal: () => void
}) {
  const paymentLabel = PAYMENT_METHODS.find((p) => p.key === data.paymentMethod)?.label ?? 'Cash'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        {/* Success header */}
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="mt-3 font-display text-lg font-bold text-slate-900">Order Completed!</h3>
          <p className="text-sm text-slate-500">Bill No: {order.id}</p>
        </div>

        {/* Receipt preview */}
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs text-slate-700">
          <div className="mb-3 text-center">
            <p className="font-display text-sm font-bold text-slate-900">Zubkas StorePulse</p>
            <p className="text-[10px] text-slate-400">Zubkas Technology Pvt Ltd</p>
          </div>
          <div className="mb-2 flex justify-between border-b border-slate-200 pb-2">
            <span>Bill: {order.id}</span>
            <span>{order.date}</span>
          </div>
          <div className="mb-2 flex justify-between border-b border-slate-200 pb-2">
            <span>Customer:</span>
            <span className="font-medium">{data.customerName}</span>
          </div>
          {data.customerPhone && (
            <div className="mb-2 flex justify-between border-b border-slate-200 pb-2">
              <span>Phone:</span>
              <span>{data.customerPhone}</span>
            </div>
          )}
          {/* Items */}
          <div className="mb-2 space-y-1 border-b border-slate-200 pb-2">
            {data.lines.map((l) => (
              <div key={l.productId} className="flex justify-between">
                <span className="truncate pr-2">{l.quantity}x {l.name}</span>
                <span className="shrink-0">{formatCurrency(l.price * l.quantity)}</span>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(data.discount)}</span>
              </div>
            )}
            {data.tax > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(data.tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-1 font-bold">
              <span>TOTAL</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid via</span>
              <span className="font-medium">{paymentLabel}</span>
            </div>
          </div>
          <div className="mt-3 text-center text-[10px] text-slate-400">
            Thank you for shopping with us!
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2">
          <button
            onClick={onPrintThermal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" /> Print Thermal Receipt
          </button>
          <div className="flex gap-3">
            <button
              onClick={onPreviewThermal}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <ReceiptIcon className="h-4 w-4" /> Preview Slip
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


