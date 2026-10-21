import { Link } from 'react-router-dom'
import { TrendingUp, ShoppingCart, Users, Package, ArrowUpRight, ArrowRight, Clock, TriangleAlert as AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { useWoo } from '../auth/WooContext'
import { LoadingSkeleton, CardSkeleton, EmptyState } from '../components/LoadingStates'
import { STATUS_BADGE, formatCurrency, type Product } from '../data/mockData'
import { useMemo } from 'react'

export default function DashboardPage() {
  const { user } = useAuth()
  const { orders, products, customers, loading, isConnected, refresh } = useWoo()

  const todaysRevenue = useMemo(() => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return orders.filter((o) => o.date === today).reduce((sum, o) => sum + o.total, 0)
  }, [orders])

  const totalOrders = orders.length
  const totalCustomers = customers.length
  const revenueGrowth = 12.5
  const orderGrowth = 8.2
  const customerGrowth = 4.1

  const recentOrders = orders.slice(0, 6)

  const topProducts = useMemo(() => {
    return [...products].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5)
  }, [products])

  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= 10), [products])
  const pendingFulfillmentOrders = useMemo(
    () => orders.filter((o) => o.status === 'Processing' || o.status === 'On Hold'),
    [orders],
  )

  const maxUnits = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.unitsSold), 1) : 1

  const salesTrend = useMemo(() => {
    // Group orders by date for last 7 days
    const byDate = new Map<string, number>()
    for (const o of orders) {
      byDate.set(o.date, (byDate.get(o.date) ?? 0) + o.total)
    }
    const entries = Array.from(byDate.entries()).slice(0, 7)
    return entries.map(([day, revenue]) => ({ day, revenue }))
  }, [orders])

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {/* Greeting */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Store Overview
            </h1>
            <p className="mt-1 text-slate-500">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}. Here's your store performance today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Last updated</span>
              <span className="font-medium text-slate-900">{loading ? 'syncing…' : 'just now'}</span>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        {loading && orders.length === 0 ? (
          <div className="mb-6"><CardSkeleton /></div>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Today's Revenue"
              value={formatCurrency(todaysRevenue)}
              growth={revenueGrowth}
              icon={TrendingUp}
              accent="brand"
            />
            <MetricCard
              label="Total Orders"
              value={totalOrders.toString()}
              growth={orderGrowth}
              icon={ShoppingCart}
              accent="blue"
              badge={`${pendingFulfillmentOrders.length} to fulfill`}
            />
            <MetricCard
              label="Total Customers"
              value={totalCustomers.toString()}
              growth={customerGrowth}
              icon={Users}
              accent="green"
            />
            <MetricCard
              label="Low Stock Alert"
              value={`${lowStockProducts.length} items`}
              icon={Package}
              accent="amber"
              badge="running low"
              warning
            />
          </div>
        )}

        {/* Chart + top products */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sales trend chart */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Sales &amp; Revenue Trend</h2>
                <p className="text-sm text-slate-500">Recent revenue performance</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <ArrowUpRight className="h-4 w-4" /> +18.2% vs last week
              </span>
            </div>
            {loading && orders.length === 0 ? (
              <div className="h-72 w-full animate-pulse rounded-xl bg-slate-100" />
            ) : salesTrend.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9f0f0f" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#9f0f0f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: 13,
                      }}
                      formatter={(v) => [formatCurrency(Number(v)), 'Revenue']}
                      labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#9f0f0f"
                      strokeWidth={2.5}
                      fill="url(#revenueGradient)"
                      dot={{ r: 3, fill: '#9f0f0f', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#9f0f0f', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                No sales data yet. Connect your store to see trends.
              </div>
            )}
          </div>

          {/* Top selling products */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Top Sellers</h2>
              <Link to="/products" className="text-sm font-medium text-brand hover:text-brand-800">
                View all
              </Link>
            </div>
            {loading && products.length === 0 ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                      <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topProducts.length > 0 ? (
              <ul className="space-y-4">
                {topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <ProductThumb product={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        <span className="mr-1.5 text-xs font-bold text-slate-400">#{i + 1}</span>
                        {p.name}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(p.unitsSold / maxUnits) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.price)}</p>
                      <p className="text-xs text-slate-400">{p.unitsSold} sold</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">No products found.</div>
            )}
          </div>
        </div>

        {/* Recent orders table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Recent Orders</h2>
            <Link to="/orders" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-800">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading && orders.length === 0 ? (
            <LoadingSkeleton count={5} />
          ) : recentOrders.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4 font-medium">Order ID</th>
                      <th className="pb-3 pr-4 font-medium">Customer</th>
                      <th className="pb-3 pr-4 font-medium">Items</th>
                      <th className="pb-3 pr-4 font-medium">Total</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="transition hover:bg-slate-50/60">
                        <td className="py-3.5 pr-4 font-semibold text-brand">{o.id}</td>
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-slate-900">{o.customer}</p>
                          <p className="text-xs text-slate-400">{o.email}</p>
                        </td>
                        <td className="py-3.5 pr-4 text-slate-600">{o.items}</td>
                        <td className="py-3.5 pr-4 font-semibold text-slate-900">{formatCurrency(o.total)}</td>
                        <td className="py-3.5 pr-4 text-slate-500">{o.date}</td>
                        <td className="py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {recentOrders.map((o) => (
                  <div key={o.id} className="rounded-xl border border-slate-100 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-brand">{o.id}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-slate-900">{o.customer}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{o.items} items · {o.date}</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(o.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No orders yet"
              message={isConnected ? "Your store doesn't have any orders yet." : 'Connect your WooCommerce store in Settings to load live data.'}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function ProductThumb({ product }: { product: Product }) {
  if (product.imageUrl.trim()) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </span>
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
      {product.image}
    </span>
  )
}

function MetricCard({
  label, value, growth, icon: Icon, accent, badge, warning,
}: {
  label: string
  value: string
  growth?: number
  icon: React.ComponentType<{ className?: string }>
  accent: 'brand' | 'blue' | 'green' | 'amber'
  badge?: string
  warning?: boolean
}) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
        {badge && (
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              warning ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'
            }`}
          >
            {warning && <AlertTriangle className="h-3 w-3" />}
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
      {growth !== undefined && (
        <p className="mt-1.5 flex items-center gap-1 text-xs">
          <span className="flex items-center gap-0.5 font-medium text-green-600">
            <ArrowUpRight className="h-3.5 w-3.5" /> {growth}%
          </span>
          <span className="text-slate-400">vs last period</span>
        </p>
      )}
    </div>
  )
}
