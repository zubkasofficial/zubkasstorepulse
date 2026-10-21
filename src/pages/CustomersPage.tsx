import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Mail, ShoppingBag, X, Calendar, TrendingUp, Package, Users, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { LoadingSkeleton, EmptyState } from '@/components/LoadingStates'
import { useWoo } from '@/auth/WooContext'
import { formatCurrency, STATUS_BADGE, type Customer, type Order } from '@/data/mockData'

export default function CustomersPage() {
  const { customers, orders, loading, isConnected, refresh } = useWoo()
  const [query, setQuery] = useState('')
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase()) ||
          c.location.toLowerCase().includes(query.toLowerCase()),
      ),
    [customers, query],
  )

  const totalSpent = customers.reduce((sum, c) => sum + c.spent, 0)
  const avgSpent = customers.length > 0 ? Math.round(totalSpent / customers.length) : 0

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Customers</h1>
            <p className="mt-1 text-slate-500">View and manage your customer base.</p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Customers', value: customers.length.toString() },
            { label: 'Total Revenue', value: formatCurrency(totalSpent) },
            { label: 'Avg. Customer Value', value: formatCurrency(avgSpent) },
            { label: 'Repeat Customers', value: customers.filter((c) => c.orders > 5).length.toString() },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-400">{s.label}</p>
              <p className="mt-1 font-display text-xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {loading && customers.length === 0 ? (
            <LoadingSkeleton count={6} />
          ) : filtered.length > 0 ? (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Location</th>
                  <th className="pb-3 pr-4">Orders</th>
                  <th className="pb-3 pr-4">Total Spent</th>
                  <th className="pb-3 pr-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setActiveCustomer(c)}
                    className="cursor-pointer transition hover:bg-slate-50/60"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                          {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" /> {c.location}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-slate-600">{c.orders}</td>
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">{formatCurrency(c.spent)}</td>
                    <td className="py-3.5 pr-4 text-slate-500">{c.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCustomer(c)}
                className="block w-full rounded-xl border border-slate-100 p-3.5 text-left transition hover:border-brand/30 hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                    {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{c.orders} orders · {c.location}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(c.spent)}</span>
                </div>
              </button>
            ))}
          </div>

          </>
          ) : (
            <EmptyState
              icon={Users}
              title="No customers found"
              message={isConnected ? 'Your store has no customers matching the current search.' : 'Connect your WooCommerce store in Settings to load live customers.'}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>

      <CustomerDetailDrawer customer={activeCustomer} orders={orders} onClose={() => setActiveCustomer(null)} />
    </AppLayout>
  )
}

/* ---------------- Customer Detail Drawer ---------------- */

function CustomerDetailDrawer({ customer, orders, onClose }: { customer: Customer | null; orders: Order[]; onClose: () => void }) {
  useEffect(() => {
    if (!customer) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [customer, onClose])

  const recentOrders = useMemo<Order[]>(() => {
    if (!customer) return []
    return orders.filter((o) => o.customer === customer.name)
  }, [customer, orders])

  if (!customer) return null

  const avgOrderValue = customer.orders > 0 ? Math.round(customer.spent / customer.orders) : 0

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-2xl animate-slide-in-right sm:max-w-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
              {customer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Customer</p>
              <h2 className="font-display text-xl font-bold text-slate-900">{customer.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Contact */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Mail className="h-3.5 w-3.5" />
              </span>
              Contact
            </h3>
            <div className="space-y-2 rounded-xl border border-slate-100 p-4 text-sm">
              <p className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" /> {customer.email}
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> {customer.location}
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Joined {customer.joined}
              </p>
            </div>
          </section>

          {/* Lifetime stats */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              Lifetime Value
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Total Spent</p>
                <p className="mt-1 font-display text-lg font-bold text-brand">{formatCurrency(customer.spent)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Orders</p>
                <p className="mt-1 font-display text-lg font-bold text-slate-900">{customer.orders}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400">Avg / Order</p>
                <p className="mt-1 font-display text-lg font-bold text-slate-900">{formatCurrency(avgOrderValue)}</p>
              </div>
            </div>
          </section>

          {/* Recent orders */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <ShoppingBag className="h-3.5 w-3.5" />
              </span>
              Recent Orders
            </h3>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand">{o.id}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <Package className="h-3 w-3" /> {o.items} items · {o.date}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-semibold text-slate-900">{formatCurrency(o.total)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 p-6 text-center text-sm text-slate-400">
                No recent orders for this customer.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
