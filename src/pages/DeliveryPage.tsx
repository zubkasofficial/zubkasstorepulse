import { useMemo, useState } from 'react'
import { Bike, MapPin, Phone, CircleCheck as CheckCircle2, Navigation, Wallet, Package, Loader as Loader2, X, Clock, RefreshCw, User } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import SignaturePad from '@/components/SignaturePad'
import { EmptyState } from '@/components/LoadingStates'
import { useWoo } from '@/auth/WooContext'
import { completeOrderDelivery } from '@/lib/woocommerce'
import {
  getDeliveryStaff, getAssignment, getAllCompletions,
  buildDirectionsUrl, buildTelUrl,
} from '@/lib/deliveryStaff'
import { formatCurrency, type Order } from '@/data/mockData'
import { resolveCustomerName } from '@/lib/customerName'
import type { Customer } from '@/data/mockData'

export default function DeliveryPage() {
  const { orders, customers, loading, connection, refresh, updateOrder, pushToast } = useWoo()
  const [staffId, setStaffId] = useState('all')
  const [completeTarget, setCompleteTarget] = useState<Order | null>(null)
  const [signature, setSignature] = useState('')
  const [processing, setProcessing] = useState(false)

  const staff = useMemo(() => getDeliveryStaff(), [])

  const assignedOrders = useMemo(() => {
    return orders.filter((o) => {
      const a = getAssignment(o.id)
      if (!a) return false
      if (o.status === 'Completed') return false
      if (staffId === 'all') return true
      return a.staffId === staffId
    })
  }, [orders, staffId])

  const completedToday = useMemo(() => {
    const completions = getAllCompletions()
    const today = new Date().toDateString()
    return orders.filter((o) => {
      const c = completions[o.id]
      if (!c) return false
      return new Date(c.completedAt).toDateString() === today
    }).length
  }, [orders])

  const cashToCollect = useMemo(() => {
    return assignedOrders
      .filter((o) => o.payment === 'Pending' || o.paymentMethod.toLowerCase().includes('cod'))
      .reduce((sum, o) => sum + o.total, 0)
  }, [assignedOrders])

  const handleComplete = async () => {
    if (!completeTarget || processing) return
    if (!signature) {
      pushToast('error', 'Please collect a signature before marking as delivered.')
      return
    }
    setProcessing(true)
    updateOrder(completeTarget.id, { status: 'Completed' })
    if (connection) {
      try {
        await completeOrderDelivery(connection, completeTarget.id, signature)
        pushToast('success', `Order ${completeTarget.id} marked as delivered and synced to WooCommerce.`)
        refresh()
      } catch (err) {
        pushToast('error', `Marked locally, but sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } else {
      pushToast('success', `Order ${completeTarget.id} marked as delivered (local mode).`)
    }
    setProcessing(false)
    setCompleteTarget(null)
    setSignature('')
  }

  const handleCloseModal = () => {
    if (processing) return
    setCompleteTarget(null)
    setSignature('')
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-brand">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Delivery Hub</h1>
              <p className="text-sm text-slate-500">Mobile delivery portal for your field staff.</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Staff filter */}
        <div className="mb-5">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <User className="h-4 w-4 text-slate-400" /> Select Delivery Staff
          </label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="input-field max-w-xs"
          >
            <option value="all">All Staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'On Leave' ? '(On Leave)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Summary badges */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryBadge
            label="Pending"
            value={assignedOrders.length.toString()}
            icon={Package}
            accent="brand"
          />
          <SummaryBadge
            label="Delivered Today"
            value={completedToday.toString()}
            icon={CheckCircle2}
            accent="green"
          />
          <SummaryBadge
            label="Cash to Collect"
            value={formatCurrency(cashToCollect)}
            icon={Wallet}
            accent="amber"
          />
        </div>

        {/* Order cards */}
        {loading && orders.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : assignedOrders.length > 0 ? (
          <div className="space-y-4">
            {assignedOrders.map((o) => (
              <DeliveryCard
                key={o.id}
                order={o}
                customers={customers}
                onComplete={() => { setCompleteTarget(o); setSignature('') }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <EmptyState
              icon={Package}
              title="No deliveries assigned"
              message={
                staffId === 'all'
                  ? 'No orders have been assigned to delivery staff yet. Assign orders from the Orders page.'
                  : 'No active deliveries assigned to this staff member.'
              }
              onRefresh={refresh}
            />
          </div>
        )}
      </div>

      {/* Complete Delivery Modal */}
      {completeTarget && (
        <CompleteDeliveryModal
          order={completeTarget}
          customers={customers}
          signature={signature}
          onSignatureChange={setSignature}
          onClose={handleCloseModal}
          onConfirm={handleComplete}
          processing={processing}
        />
      )}
    </AppLayout>
  )
}

/* ---------------- Summary Badge ---------------- */

function SummaryBadge({
  label, value, icon: Icon, accent,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'brand' | 'green' | 'amber'
}) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentMap[accent]}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

/* ---------------- Delivery Card ---------------- */

function DeliveryCard({ order, customers, onComplete }: { order: Order; customers: Customer[]; onComplete: () => void }) {
  const assignment = getAssignment(order.id)
  const isCod = order.payment === 'Pending' || order.paymentMethod.toLowerCase().includes('cod')
  const customerName = resolveCustomerName(order, customers)
  const deliveryAddress = order.shippingAddress || order.billingAddress

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md animate-fade-in">
      {/* Top: order id + time */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-bold text-brand">{order.id}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" /> {order.date}
          </p>
        </div>
        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
          Out for Delivery
        </span>
      </div>

      {/* Assignment info */}
      {assignment && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Bike className="h-3.5 w-3.5 text-slate-400" />
          Assigned to <span className="font-medium text-slate-700">{assignment.staffName}</span>
          <span className="text-slate-300">·</span>
          <span className="font-mono">{assignment.vehicle}</span>
        </div>
      )}

      {/* Customer info */}
      <div className="mb-3 space-y-1.5 rounded-xl border border-slate-100 p-3.5 text-sm">
        <p className="font-semibold text-slate-900">{customerName}</p>
        <p className="flex items-start gap-2 text-slate-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="leading-relaxed">{deliveryAddress}</span>
        </p>
      </div>

      {/* Payment badge */}
      <div className="mb-4">
        {isCod ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            <Wallet className="h-4 w-4" /> Collect Cash: {formatCurrency(order.total)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Prepaid — Paid Online
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href={buildDirectionsUrl(order.shippingAddress || order.billingAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-brand/30 hover:bg-brand-50 hover:text-brand"
        >
          <Navigation className="h-4 w-4" />
          Directions
        </a>
        <a
          href={buildTelUrl(order.phone)}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
        >
          <Phone className="h-4 w-4" />
          Call
        </a>
        <button
          onClick={onComplete}
          className="flex flex-col items-center gap-1 rounded-xl border border-brand bg-brand px-2 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-95"
        >
          <CheckCircle2 className="h-4 w-4" />
          Delivered
        </button>
      </div>
    </div>
  )
}

/* ---------------- Complete Delivery Modal ---------------- */

function CompleteDeliveryModal({
  order, customers, signature, onSignatureChange, onClose, onConfirm, processing,
}: {
  order: Order
  customers: Customer[]
  signature: string
  onSignatureChange: (s: string) => void
  onClose: () => void
  onConfirm: () => void
  processing: boolean
}) {
  const customerName = resolveCustomerName(order, customers)
  const deliveryAddress = order.shippingAddress || order.billingAddress
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Order {order.id}</p>
              <h2 className="font-display text-lg font-bold text-slate-900">Complete Delivery</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer summary */}
        <div className="mb-4 rounded-xl border border-slate-100 p-4 text-sm">
          <p className="font-semibold text-slate-900">{customerName}</p>
          <p className="mt-1 flex items-start gap-2 text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {deliveryAddress}
          </p>
          <p className="mt-1.5 font-semibold text-brand">{formatCurrency(order.total)}</p>
        </div>

        {/* Signature pad */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Customer Signature</label>
          <SignaturePad value={signature} onChange={onSignatureChange} />
        </div>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          disabled={processing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#9f0f0f]/30 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Marking as Delivered…</>
          ) : (
            <><CheckCircle2 className="h-5 w-5" /> Mark as Delivered</>
          )}
        </button>
      </div>
    </div>
  )
}
