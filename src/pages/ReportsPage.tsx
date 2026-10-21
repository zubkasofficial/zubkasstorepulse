import { useMemo, useState } from 'react'
import {
  BarChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Wallet, Download, Package,
  ChartBar as BarChart3,
  ArrowUpRight, ArrowDownRight, Receipt, Truck, Search,
  ChevronLeft, ChevronRight, RefreshCw, Calendar, X, Check,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useWoo } from '../auth/WooContext'
import { formatCurrency, type Order, type Product, type OrderStatus, type DateRangeKey } from '../data/mockData'
import { resolveCustomerName } from '@/lib/customerName'

type RangeKey = DateRangeKey

const DATE_RANGES: RangeKey[] = ['today', 'yesterday', '7d', '30d', 'this_month', 'last_month', 'ytd', 'custom']

const STATUS_COLORS: Record<OrderStatus, string> = {
  Completed: '#16a34a',
  Processing: '#0ea5e9',
  'On Hold': '#f59e0b',
  Cancelled: '#ef4444',
  Refunded: '#94a3b8',
  Shipped: '#6366f1',
  'Out for Delivery': '#8b5cf6',
}

const ALL_STATUSES: OrderStatus[] = ['Completed', 'Processing', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery']

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  upi: '#8b5cf6',
  card: '#0ea5e9',
  cod: '#f59e0b',
  'net banking': '#16a34a',
  paypal: '#6366f1',
  default: '#9f0f0f',
}

const TAX_RATE = 0.18 // 18% GST estimate
const SHIPPING_RATE = 0.05 // 5% shipping estimate

export default function ReportsPage() {
  const { orders, products, customers, loading, isConnected, refresh } = useWoo()
  const [range, setRange] = useState<RangeKey>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const { currentStart, prevStart, prevEnd, rangeEnd } = useMemo(
    () => dateRangeBounds(range, customStart, customEnd),
    [range, customStart, customEnd],
  )

  const inRangeOrders = useMemo(
    () => orders.filter((o) => {
      const d = parseOrderDate(o.date)
      return d >= currentStart && d <= rangeEnd
    }),
    [orders, currentStart, rangeEnd],
  )
  const prevRangeOrders = useMemo(
    () => orders.filter((o) => {
      const d = parseOrderDate(o.date)
      return d >= prevStart && d < prevEnd
    }),
    [orders, prevStart, prevEnd],
  )

  const hasData = inRangeOrders.length > 0

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const validOrders = inRangeOrders.filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
    const grossSales = validOrders.reduce((sum, o) => sum + o.total, 0)
    const totalTax = validOrders.reduce((sum, o) => sum + o.total * TAX_RATE / (1 + TAX_RATE), 0)
    const shippingFees = validOrders.reduce((sum, o) => sum + o.total * SHIPPING_RATE / (1 + SHIPPING_RATE + TAX_RATE), 0)
    const netSales = grossSales - totalTax - shippingFees
    const totalOrders = inRangeOrders.length
    const aov = totalOrders > 0 ? Math.round(grossSales / totalOrders) : 0

    const prevValid = prevRangeOrders.filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
    const prevGross = prevValid.reduce((sum, o) => sum + o.total, 0)
    const prevOrders = prevRangeOrders.length
    const prevAov = prevOrders > 0 ? Math.round(prevGross / prevOrders) : 0

    return {
      grossSales,
      grossSalesGrowth: pctChange(grossSales, prevGross),
      netSales,
      totalOrders,
      ordersPrev: prevOrders,
      ordersGrowth: pctChange(totalOrders, prevOrders),
      totalTax,
      aov,
      aovGrowth: pctChange(aov, prevAov),
      shippingFees,
    }
  }, [inRangeOrders, prevRangeOrders])

  // ---- Timeline chart data ----
  const trend = useMemo(() => buildTrendData(inRangeOrders, range), [inRangeOrders, range])

  // ---- Top selling products (from line items) ----
  const topProducts = useMemo(() => {
    const productMap = new Map<string, Product>()
    for (const p of products) productMap.set(p.id, p)

    const productSales = new Map<string, { name: string; imageUrl: string; image: string; unitsSold: number; revenue: number }>()
    for (const o of inRangeOrders) {
      if (o.status === 'Cancelled' || o.status === 'Refunded') continue
      for (const li of o.lineItems) {
        const prod = productMap.get(li.productId)
        const key = li.productId
        const existing = productSales.get(key) ?? { name: li.name, imageUrl: prod?.imageUrl ?? '', image: prod?.image ?? '📦', unitsSold: 0, revenue: 0 }
        existing.unitsSold += li.quantity
        existing.revenue += li.unitPrice * li.quantity
        productSales.set(key, existing)
      }
    }
    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [inRangeOrders, products])

  const maxProductRevenue = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.revenue), 1) : 1

  // ---- Payment methods breakdown ----
  const paymentData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of inRangeOrders) {
      if (o.status === 'Cancelled' || o.status === 'Refunded') continue
      const method = normalizePaymentMethod(o.paymentMethod)
      counts.set(method, (counts.get(method) ?? 0) + 1)
    }
    const total = Array.from(counts.values()).reduce((s, v) => s + v, 0)
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      value: total > 0 ? Math.round((count / total) * 100) : 0,
      count,
      color: PAYMENT_METHOD_COLORS[name.toLowerCase()] ?? PAYMENT_METHOD_COLORS.default,
    })).sort((a, b) => b.count - a.count)
  }, [inRangeOrders])

  // ---- Status distribution ----
  const statusData = useMemo(() => {
    const counts = new Map<OrderStatus, number>()
    for (const s of ALL_STATUSES) counts.set(s, 0)
    for (const o of inRangeOrders) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1)
    }
    const total = inRangeOrders.length
    return ALL_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
      name: s,
      value: total > 0 ? Math.round(((counts.get(s) ?? 0) / total) * 100) : 0,
      count: counts.get(s) ?? 0,
      color: STATUS_COLORS[s],
    }))
  }, [inRangeOrders])

  // ---- GST / Tax breakdown table ----
  const taxRows = useMemo(() => {
    return inRangeOrders
      .filter((o) => o.status !== 'Cancelled')
      .map((o) => {
        const taxableAmount = o.total / (1 + TAX_RATE)
        const totalTax = o.total - taxableAmount
        const cgst = totalTax / 2
        const sgst = totalTax / 2
        return {
          id: o.id,
          date: o.date,
          customer: resolveCustomerName(o, customers),
          grossTotal: o.total,
          taxableAmount,
          cgst,
          sgst,
          igst: totalTax,
          totalTax,
          status: o.status,
        }
      })
  }, [inRangeOrders, customers])

  const filteredTaxRows = useMemo(() => {
    if (!search.trim()) return taxRows
    const q = search.toLowerCase()
    return taxRows.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.date.toLowerCase().includes(q),
    )
  }, [taxRows, search])

  const totalPages = Math.max(1, Math.ceil(filteredTaxRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedTaxRows = filteredTaxRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ---- Export CSV ----
  const handleExport = () => {
    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Customer Email',
      'Item Details',
      'Gross Total (₹)',
      'Taxable Amount (₹)',
      'CGST (₹)',
      'SGST (₹)',
      'Total Tax (₹)',
      'Shipping (₹)',
      'Net Sales (₹)',
      'Payment Method',
      'Payment Status',
      'Order Status',
    ]
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows = inRangeOrders
      .filter((o) => o.status !== 'Cancelled')
      .map((o) => {
        const taxableAmount = o.total / (1 + TAX_RATE)
        const totalTax = o.total - taxableAmount
        const cgst = totalTax / 2
        const sgst = totalTax / 2
        const shipping = o.total * SHIPPING_RATE / (1 + SHIPPING_RATE + TAX_RATE)
        const netSales = o.total - totalTax - shipping
        const itemDetails = o.lineItems.map((li) => `${li.quantity}x ${li.name}`).join('; ')
        return [
          o.id,
          o.date,
          resolveCustomerName(o, customers),
          o.email,
          itemDetails,
          o.total.toFixed(2),
          taxableAmount.toFixed(2),
          cgst.toFixed(2),
          sgst.toFixed(2),
          totalTax.toFixed(2),
          shipping.toFixed(2),
          netSales.toFixed(2),
          o.paymentMethod,
          o.payment,
          o.status,
        ].map(escape).join(',')
      })
    const csv = [headers.map(escape).join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `zubkas-report-${rangeLabel(range)}-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRangeChange = (r: RangeKey) => {
    setRange(r)
    setPage(1)
    if (r === 'custom') {
      setShowCustomPicker(true)
    } else {
      setShowCustomPicker(false)
    }
  }

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      setShowCustomPicker(false)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Reports &amp; Analytics</h1>
            <p className="mt-1 text-slate-500">Financial summaries, tax breakdowns, and exportable sales records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={!hasData}
              className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export to Excel / CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-fade-in">
          <div className="flex flex-wrap items-center gap-2">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  range === r
                    ? 'bg-[#9f0f0f] text-white shadow-md shadow-[#9f0f0f]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'custom' && <Calendar className="h-3.5 w-3.5" />}
                {rangeLabel(r)}
              </button>
            ))}
          </div>

          {showCustomPicker && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 animate-fade-in">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <button
                onClick={applyCustomRange}
                disabled={!customStart || !customEnd}
                className="flex items-center gap-1.5 rounded-lg bg-[#9f0f0f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#880d0d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Apply
              </button>
              <button
                onClick={() => { setShowCustomPicker(false); setRange('30d') }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          )}
        </div>

        {loading && orders.length === 0 ? (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="mt-4 h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-6 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <BarChart3 className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No analytics data available yet</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {isConnected
                  ? 'No orders found in the selected period. Try a different date range or sync your store.'
                  : 'Connect your WooCommerce store in Settings and sync orders to generate insights.'}
              </p>
              {refresh && (
                <button
                  onClick={refresh}
                  className="mt-5 flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
                >
                  <TrendingUp className="h-4 w-4" /> Sync Store Data
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Total Gross Sales" value={formatCurrency(kpis.grossSales)} growth={kpis.grossSalesGrowth} icon={TrendingUp} accent="brand" />
              <KpiCard label="Net Sales" value={formatCurrency(kpis.netSales)} icon={Wallet} accent="green" />
              <KpiCard label="Total Orders" value={kpis.totalOrders.toString()} comparison={`${kpis.ordersPrev} prev period`} growth={kpis.ordersGrowth} icon={ShoppingCart} accent="blue" />
              <KpiCard label="Total GST / Tax Collected" value={formatCurrency(kpis.totalTax)} icon={Receipt} accent="amber" />
              <KpiCard label="Avg. Order Value (AOV)" value={formatCurrency(kpis.aov)} growth={kpis.aovGrowth} icon={Wallet} accent="brand" />
              <KpiCard label="Shipping Fees Collected" value={formatCurrency(kpis.shippingFees)} icon={Truck} accent="blue" />
            </div>

            {/* Revenue & Orders Trend */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Revenue &amp; Orders Trend</h2>
                  <p className="text-sm text-slate-500">{rangeLabel(range)} — revenue (bars) and order count (line)</p>
                </div>
                {kpis.grossSalesGrowth !== 0 && (
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                      kpis.grossSalesGrowth >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {kpis.grossSalesGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {kpis.grossSalesGrowth >= 0 ? '+' : ''}{kpis.grossSalesGrowth}% vs prev
                  </span>
                )}
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
                      formatter={(v, name) => name === 'revenue' ? [formatCurrency(Number(v)), 'Revenue'] : [String(v), 'Orders']}
                      labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                    />
                    <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 12, color: '#64748b', paddingBottom: 8 }} />
                    <Bar yAxisId="left" dataKey="revenue" name="revenue" fill="#9f0f0f" radius={[6, 6, 0, 0]} barSize={32} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="orders" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: '#0ea5e9' }} activeDot={{ r: 5 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Payment Methods Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-slate-900">Payment Methods</h2>
                  <p className="text-sm text-slate-500">Breakdown by payment type</p>
                </div>
                {paymentData.length > 0 ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {paymentData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                          formatter={(v, _name, props) => {
                            const count = (props?.payload as { count?: number })?.count ?? 0
                            return [`${v}% (${count} orders)`, '']
                          }}
                        />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-slate-400">No payment data available.</div>
                )}
              </div>

              {/* Order Status Distribution */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-slate-900">Order Status Distribution</h2>
                  <p className="text-sm text-slate-500">Breakdown of orders by status</p>
                </div>
                {statusData.length > 0 ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {statusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                          formatter={(v, _name, props) => {
                            const count = (props?.payload as { count?: number })?.count ?? 0
                            return [`${v}% (${count} orders)`, '']
                          }}
                        />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-slate-400">No status data available.</div>
                )}
              </div>
            </div>

            {/* Top Selling Products Leaderboard */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Top Selling Products</h2>
                  <p className="text-sm text-slate-500">Leaderboard by unit sales and revenue</p>
                </div>
                <Package className="h-5 w-5 text-slate-300" />
              </div>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50/60">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#9f0f0f] text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <span className="text-lg">{p.image}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#9f0f0f] transition-all duration-500" style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.revenue)}</p>
                        <p className="text-xs text-slate-400">{p.unitsSold} units sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-slate-400">No product sales data available for this period.</div>
              )}
            </div>

            {/* GST & Tax Breakdown Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">GST &amp; Tax Breakdown</h2>
                  <p className="text-sm text-slate-500">Detailed tax records for accounting</p>
                </div>
                <div className="relative sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Search by order ID, customer, or date…"
                    className="input-field pl-10 text-sm"
                  />
                </div>
              </div>

              {pagedTaxRows.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                          <th className="pb-3 pr-4">Order ID</th>
                          <th className="pb-3 pr-4">Date</th>
                          <th className="pb-3 pr-4">Customer</th>
                          <th className="pb-3 pr-4 text-right">Gross Total</th>
                          <th className="pb-3 pr-4 text-right">Taxable Amt</th>
                          <th className="pb-3 pr-4 text-right">CGST</th>
                          <th className="pb-3 pr-4 text-right">SGST</th>
                          <th className="pb-3 pr-4 text-right">Total Tax</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pagedTaxRows.map((r) => (
                          <tr key={r.id} className="transition hover:bg-slate-50/60">
                            <td className="py-3.5 pr-4 font-semibold text-[#9f0f0f]">{r.id}</td>
                            <td className="py-3.5 pr-4 text-slate-500">{r.date}</td>
                            <td className="py-3.5 pr-4 font-medium text-slate-900">{r.customer}</td>
                            <td className="py-3.5 pr-4 text-right font-semibold text-slate-900">{formatCurrency(r.grossTotal)}</td>
                            <td className="py-3.5 pr-4 text-right text-slate-600">{formatCurrency(r.taxableAmount)}</td>
                            <td className="py-3.5 pr-4 text-right text-slate-600">{formatCurrency(r.cgst)}</td>
                            <td className="py-3.5 pr-4 text-right text-slate-600">{formatCurrency(r.sgst)}</td>
                            <td className="py-3.5 pr-4 text-right font-semibold text-slate-900">{formatCurrency(r.totalTax)}</td>
                            <td className="py-3.5">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTaxRows.length)} of {filteredTaxRows.length} records
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium text-slate-700">{currentPage} / {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-slate-400">
                  {search ? 'No records match your search.' : 'No tax records available for this period.'}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 bg-white/60 py-5 text-center text-xs text-slate-400">
          Powered by Zubkas Technology Private Limited · Support: support@zubkas.com · Reports generated from live WooCommerce order data
        </footer>
      </div>
    </AppLayout>
  )
}

/* ---------------- helpers ---------------- */

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  Completed: 'bg-green-50 text-green-700',
  Processing: 'bg-blue-50 text-blue-700',
  'On Hold': 'bg-amber-50 text-amber-700',
  Cancelled: 'bg-red-50 text-red-700',
  Refunded: 'bg-slate-100 text-slate-600',
  Shipped: 'bg-indigo-50 text-indigo-700',
  'Out for Delivery': 'bg-purple-50 text-purple-700',
}

function rangeLabel(r: RangeKey): string {
  const map: Record<RangeKey, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    this_month: 'This Month',
    last_month: 'Last Month',
    ytd: 'This Year',
    custom: 'Custom Range',
  }
  return map[r]
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function parseOrderDate(dateStr: string): Date {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    const parts = dateStr.split(', ')
    if (parts.length === 2) {
      const d2 = new Date(`${parts[0]} ${parts[1]}`)
      if (!isNaN(d2.getTime())) return d2
    }
    return new Date(0)
  }
  return d
}

function dateRangeBounds(range: RangeKey, customStart: string, customEnd: string): {
  currentStart: Date
  prevStart: Date
  prevEnd: Date
  rangeEnd: Date
} {
  const now = new Date()

  if (range === 'custom' && customStart && customEnd) {
    const start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    const spanMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - spanMs)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 1)
    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  if (range === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 1)
    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
    const prevEnd = new Date(start)
    prevEnd.setMilliseconds(-1)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  if (range === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    const prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
  }

  // 7d or 30d
  const days = range === '7d' ? 7 : 30
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  const prevEnd = new Date(start)
  prevEnd.setMilliseconds(-1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days)
  prevStart.setHours(0, 0, 0, 0)
  return { currentStart: start, prevStart, prevEnd, rangeEnd: end }
}

function buildTrendData(orders: Order[], range: RangeKey): Array<{ label: string; revenue: number; orders: number }> {
  const revenueByBucket = new Map<string, { revenue: number; orders: number }>()

  for (const o of orders) {
    const d = parseOrderDate(o.date)
    if (isNaN(d.getTime())) continue

    const bucket = getBucketLabel(d, range)
    const existing = revenueByBucket.get(bucket) ?? { revenue: 0, orders: 0 }
    const included = o.status !== 'Cancelled' && o.status !== 'Refunded'
    revenueByBucket.set(bucket, {
      revenue: included ? existing.revenue + o.total : existing.revenue,
      orders: existing.orders + 1,
    })
  }

  return Array.from(revenueByBucket.entries()).map(([label, v]) => ({
    label,
    revenue: v.revenue,
    orders: v.orders,
  }))
}

function getBucketLabel(d: Date, range: RangeKey): string {
  if (range === 'today' || range === 'yesterday') {
    return d.toLocaleDateString('en-US', { hour: 'numeric' })
  }
  if (range === '7d') {
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }
  if (range === '30d' || range === 'this_month' || range === 'last_month') {
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleDateString('en-US', { month: 'short' })
}

function normalizePaymentMethod(method: string): string {
  const m = method.toLowerCase()
  if (m.includes('upi') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm')) return 'UPI'
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return 'Card'
  if (m.includes('cod') || m.includes('cash') || m.includes('on delivery')) return 'COD'
  if (m.includes('net') || m.includes('banking') || m.includes('bank')) return 'Net Banking'
  if (m.includes('paypal')) return 'PayPal'
  if (m === '—' || m === '-' || m === '') return 'Other'
  return method
}

/* ---------------- KPI card ---------------- */

function KpiCard({
  label, value, growth, comparison, icon: Icon, accent,
}: {
  label: string
  value: string
  growth?: number
  comparison?: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'brand' | 'blue' | 'green' | 'amber'
}) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  const positive = (growth ?? 0) >= 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
        {growth !== undefined && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
      {comparison && <p className="mt-1 text-xs text-slate-400">{comparison}</p>}
    </div>
  )
}
