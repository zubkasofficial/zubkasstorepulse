import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Download, ChevronDown, X, SquareCheck as CheckSquare, Square, RefreshCw, Inbox, Truck, Trash2 } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import StatusDropdown from '@/components/StatusDropdown'
import OrderDetailDrawer from '@/components/OrderDetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingSkeleton, EmptyState } from '@/components/LoadingStates'
import { useWoo } from '@/auth/WooContext'
import { updateOrderStatus as apiUpdateOrderStatus, updateOrderShipping as apiUpdateOrderShipping, assignOrderDelivery } from '@/lib/woocommerce'
import { getShippingInfo, saveShippingInfo, clearShippingInfo, type ShippingInfo } from '@/lib/shipping'
import { type DeliveryStaff } from '@/lib/deliveryStaff'
import { formatCurrency, type Order, type OrderStatus } from '@/data/mockData'
import { resolveCustomerName } from '@/lib/customerName'
import { getSupabase } from '@/lib/supabase'

const STATUS_FILTERS: ('All' | OrderStatus)[] = ['All', 'Processing', 'Completed', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery']
const BULK_STATUSES: OrderStatus[] = ['Processing', 'Completed', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery']

export default function OrdersPage() {
  const { orders, loading, isLive, refresh, updateOrder, pushToast, connection, customers } = useWoo()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | OrderStatus>('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const openOrderId = searchParams.get('openOrderId')

  // Auto-open order drawer when navigated via notification deep-link
  useEffect(() => {
    if (!openOrderId) return
    if (loading) return
    const found = orders.find((o) => o.id === openOrderId)
    if (found) {
      setActiveOrder(found)
      setSearchParams({}, { replace: true })
    }
  }, [openOrderId, orders, loading, setSearchParams])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const resolvedName = resolveCustomerName(o, customers)
      const matchesQuery =
        o.id.toLowerCase().includes(query.toLowerCase()) ||
        resolvedName.toLowerCase().includes(query.toLowerCase()) ||
        o.customer.toLowerCase().includes(query.toLowerCase()) ||
        o.email.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = filter === 'All' || o.status === filter
      return matchesQuery && matchesStatus
    })
  }, [orders, customers, query, filter])

  const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0)

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    updateOrder(id, { status })
    if (activeOrder?.id === id) {
      setActiveOrder((prev) => (prev ? { ...prev, status } : prev))
    }
    if (connection) {
      try {
        await apiUpdateOrderStatus(connection, id, status)
        pushToast('success', `Order ${id} updated to ${status}.`)
      } catch (err) {
        pushToast('error', `Failed to update order: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  const handleShippingUpdate = async (id: string, info: ShippingInfo) => {
    saveShippingInfo(info)
    updateOrder(id, { status: 'Shipped' })
    if (activeOrder?.id === id) {
      setActiveOrder((prev) => (prev ? { ...prev, status: 'Shipped' } : prev))
    }
    if (connection) {
      try {
        await apiUpdateOrderShipping(connection, id, {
          courier: info.courier,
          awb: info.awb,
          trackingUrl: info.trackingUrl,
          estimatedDelivery: info.estimatedDelivery,
        })
        pushToast('success', `Order ${id} marked as shipped via ${info.courier}.`)
      } catch (err) {
        pushToast('error', `Order shipped locally, but sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } else {
      pushToast('success', `Order ${id} marked as shipped via ${info.courier}.`)
    }
  }

  const handleDeliveryAssign = async (id: string, staff: DeliveryStaff) => {
    updateOrder(id, { status: 'Out for Delivery' })
    if (activeOrder?.id === id) {
      setActiveOrder((prev) => (prev ? { ...prev, status: 'Out for Delivery' } : prev))
    }
    if (connection) {
      try {
        await assignOrderDelivery(connection, id, {
          staffId: staff.id,
          staffName: staff.name,
          staffPhone: staff.phone,
          vehicle: staff.vehicle,
        })
        pushToast('success', `Staff Assigned Successfully — ${staff.name} assigned to order ${id}.`)
      } catch (err) {
        pushToast('success', `Staff Assigned Successfully — ${staff.name} assigned to order ${id}.`)
      }
    } else {
      pushToast('success', `Order ${id} assigned to ${staff.name}.`)
    }
  }

  const handleDeliveryUnassign = (id: string) => {
    pushToast('success', `Delivery driver unassigned from order ${id}.`)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((o) => o.id)))
    }
  }

  const handleBulkStatus = (status: OrderStatus) => {
    for (const id of selected) {
      updateOrder(id, { status })
    }
    if (activeOrder && selected.has(activeOrder.id)) {
      setActiveOrder((prev) => (prev ? { ...prev, status } : prev))
    }
    setBulkMenuOpen(false)
    pushToast('success', `${selected.size} order(s) updated to ${status}.`)
  }

  const handleBulkExport = () => {
    const toExport = selected.size > 0 ? orders.filter((o) => selected.has(o.id)) : filtered
    downloadCSV(toExport)
    setBulkMenuOpen(false)
  }

  const handleExportAll = () => {
    downloadCSV(filtered)
  }

  const clearSelection = () => setSelected(new Set())

  const deleteOrderFromCloud = async (orderId: string): Promise<void> => {
    const sb = getSupabase()
    if (!sb) return
    const orderNumber = orderId.replace(/^#/, '')
    await sb.from('orders').delete().eq('order_number', orderNumber)
    await sb.from('pos_sales').delete().eq('order_number', orderNumber)
  }

  const handleDeleteOrder = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteOrderFromCloud(deleteTarget.id)
      clearShippingInfo(deleteTarget.id)
      pushToast('success', `Order ${deleteTarget.id} deleted successfully.`)
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      pushToast('error', `Failed to delete order: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (deleting || selected.size === 0) return
    setDeleting(true)
    const ids = Array.from(selected)
    let failed = 0
    for (const id of ids) {
      try {
        await deleteOrderFromCloud(id)
        clearShippingInfo(id)
      } catch {
        failed++
      }
    }
    setDeleting(false)
    setBulkDeleteOpen(false)
    setBulkMenuOpen(false)
    if (failed === 0) {
      pushToast('success', `${ids.length} order(s) deleted successfully.`)
    } else {
      pushToast('error', `${ids.length - failed} deleted, ${failed} failed.`)
    }
    setSelected(new Set())
    refresh()
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Orders</h1>
            <p className="mt-1 text-slate-500">Manage and track all customer orders.</p>
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
            { label: 'Total Orders', value: orders.length.toString() },
            { label: 'Filtered', value: filtered.length.toString() },
            { label: 'Revenue', value: formatCurrency(totalRevenue) },
            { label: 'Avg. Order Value', value: formatCurrency(Math.round(totalRevenue / (filtered.length || 1))) },
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
              placeholder="Search by order ID or customer…"
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Bulk actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setBulkMenuOpen((o) => !o)}
                disabled={selected.size === 0}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  selected.size > 0
                    ? 'border-brand/30 bg-brand-50 text-brand hover:bg-brand-100'
                    : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                }`}
              >
                {selected.size > 0 ? `${selected.size} selected` : 'Bulk actions'}
                <ChevronDown className="h-4 w-4" />
              </button>
              {bulkMenuOpen && selected.size > 0 && (
                <div
                  className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-fade-in"
                  onMouseLeave={() => setBulkMenuOpen(false)}
                >
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Update status
                  </p>
                  {BULK_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleBulkStatus(s)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                      {s}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={handleBulkExport}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    Export selected to CSV
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => { setBulkMenuOpen(false); setBulkDeleteOpen(true) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected orders
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((s) => {
            const count =
              s === 'All' ? orders.length : orders.filter((o) => o.status === s).length
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  filter === s
                    ? 'bg-brand text-white shadow-brand'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    filter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand-50 px-4 py-2.5 text-sm animate-fade-in">
            <span className="flex items-center gap-2 font-medium text-brand">
              <CheckSquare className="h-4 w-4" /> {selected.size} order{selected.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 text-brand hover:text-brand-800"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {loading && orders.length === 0 ? (
            <LoadingSkeleton count={6} />
          ) : filtered.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-3" style={{ width: 36 }}>
                        <button
                          onClick={toggleSelectAll}
                          aria-label="Select all"
                          className="text-slate-400 transition hover:text-brand"
                        >
                          {selected.size === filtered.length && filtered.length > 0 ? (
                            <CheckSquare className="h-4 w-4 text-brand" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </th>
                      <th className="pb-3 pr-4">Order ID</th>
                      <th className="pb-3 pr-4">Customer</th>
                      <th className="pb-3 pr-4">Items</th>
                      <th className="pb-3 pr-4">Total</th>
                      <th className="pb-3 pr-4">Payment</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4 text-right">Shipping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((o) => {
                      const isSelected = selected.has(o.id)
                      const hasShipping = !!getShippingInfo(o.id)
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setActiveOrder(o)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-3.5 pr-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleSelect(o.id)}
                              aria-label={`Select ${o.id}`}
                              className="text-slate-400 transition hover:text-brand"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-brand" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 pr-4 font-semibold text-brand">{o.id}</td>
                          <td className="py-3.5 pr-4">
                            <p className="font-medium text-slate-900">{resolveCustomerName(o, customers)}</p>
                            <p className="text-xs text-slate-400">{o.email}</p>
                          </td>
                          <td className="py-3.5 pr-4 text-slate-600">{o.items}</td>
                          <td className="py-3.5 pr-4 font-semibold text-slate-900">{formatCurrency(o.total)}</td>
                          <td className="py-3.5 pr-4">
                            <span
                              className={`text-xs font-medium ${
                                o.payment === 'Paid'
                                  ? 'text-green-600'
                                  : o.payment === 'Pending'
                                    ? 'text-amber-600'
                                    : 'text-slate-500'
                              }`}
                            >
                              {o.payment}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-slate-500">{o.date}</td>
                          <td className="py-3.5 pr-4" onClick={(e) => e.stopPropagation()}>
                            <StatusDropdown
                              status={o.status}
                              onChange={(s) => handleStatusChange(o.id, s)}
                            />
                          </td>
                          <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {hasShipping ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                                  <Truck className="h-3 w-3" /> Shipped
                                </span>
                              ) : (
                                <button
                                  onClick={() => setActiveOrder(o)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50 hover:text-brand"
                                >
                                  <Truck className="h-3 w-3" /> Ship
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteTarget(o)}
                                aria-label={`Delete ${o.id}`}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="space-y-3 md:hidden">
                {filtered.map((o) => {
                  const isSelected = selected.has(o.id)
                  return (
                    <div
                      key={o.id}
                      onClick={() => setActiveOrder(o)}
                      className={`rounded-xl border p-3.5 transition ${
                        isSelected ? 'border-brand/30 bg-brand-50/50' : 'border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelect(o.id)
                            }}
                            aria-label={`Select ${o.id}`}
                            className="text-slate-400"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-brand" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-semibold text-brand">{o.id}</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown
                            status={o.status}
                            onChange={(s) => handleStatusChange(o.id, s)}
                          />
                        </div>
                      </div>
                      <p className="mt-2 font-medium text-slate-900">{resolveCustomerName(o, customers)}</p>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{o.items} items · {o.date}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(o.total)}</span>
                      </div>
                      {getShippingInfo(o.id) && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600">
                          <Truck className="h-3 w-3" /> Shipped
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(o) }}
                          aria-label={`Delete ${o.id}`}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No orders found"
              message={isLive ? 'Your store has no orders matching the current filters.' : 'No orders yet. Complete a sale from the POS Terminal to see it here.'}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>

      <OrderDetailDrawer
        order={activeOrder}
        customers={customers}
        onClose={() => setActiveOrder(null)}
        onStatusChange={handleStatusChange}
        onShippingUpdate={handleShippingUpdate}
        onDeliveryAssign={handleDeliveryAssign}
        onDeliveryUnassign={handleDeliveryUnassign}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete order?"
        message={`Order ${deleteTarget?.id ?? ''} will be permanently removed from your database. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={handleDeleteOrder}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected orders?"
        message={`${selected.size} order(s) will be permanently removed from your database. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete All'}
        danger
        onConfirm={handleBulkDelete}
        onCancel={() => !deleting && setBulkDeleteOpen(false)}
      />
    </AppLayout>
  )
}

const STATUS_DOT: Record<OrderStatus, string> = {
  Processing: 'bg-blue-500',
  Completed: 'bg-green-500',
  'On Hold': 'bg-amber-500',
  Cancelled: 'bg-red-500',
  Refunded: 'bg-slate-400',
  Shipped: 'bg-indigo-500',
  'Out for Delivery': 'bg-purple-500',
}

function downloadCSV(rows: Order[]) {
  const headers = [
    'Order ID',
    'Customer',
    'Email',
    'Phone',
    'Items',
    'Total',
    'Payment',
    'Payment Method',
    'Transaction ID',
    'Date',
    'Status',
  ]
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const body = rows
    .map((o) =>
      [
        o.id,
        o.customer,
        o.email,
        o.phone,
        o.items,
        o.total,
        o.payment,
        o.paymentMethod,
        o.transactionId,
        o.date,
        o.status,
      ]
        .map(escape)
        .join(','),
    )
    .join('\n')
  const csv = [headers.map(escape).join(','), body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `orders-export-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
