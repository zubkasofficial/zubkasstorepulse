import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Printer, Phone, Mail, MapPin, CreditCard, Receipt, Package, Truck, MessageCircle, ExternalLink, QrCode as QrCodeIcon, Bike, UserCog, Circle as XCircle, Download, Loader as Loader2 } from 'lucide-react'
import { formatCurrency, STATUS_BADGE, type Order, type OrderStatus, type Customer } from '@/data/mockData'
import { resolveCustomerName } from '@/lib/customerName'
import StatusDropdown from './StatusDropdown'
import ShippingModal from './ShippingModal'
import {
  getShippingInfo, saveShippingInfo, getTrackingUrlForShipment, buildWhatsAppUrl,
  type ShippingInfo,
} from '@/lib/shipping'
import {
  getDeliveryStaff, getActiveStaff, getAssignment, assignDeliveryStaff, unassignDelivery,
  type DeliveryStaff, type DeliveryAssignment,
} from '@/lib/deliveryStaff'
import { getStoreProfile } from '@/lib/storeProfile'
import { generatePdfFromElement, quickPrintElement } from '@/lib/html2pdf'
import { type ReceiptData } from '@/lib/thermalReceipt'
import ThermalReceiptModal from './ThermalReceiptModal'

type OrderDetailDrawerProps = {
  order: Order | null
  customers?: Customer[]
  onClose: () => void
  onStatusChange: (id: string, status: OrderStatus) => void
  onShippingUpdate?: (id: string, info: ShippingInfo) => void
  onDeliveryAssign?: (id: string, staff: DeliveryStaff) => void
  onDeliveryUnassign?: (id: string) => void
}

export default function OrderDetailDrawer({ order, customers = [], onClose, onStatusChange, onShippingUpdate, onDeliveryAssign, onDeliveryUnassign }: OrderDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [shipping, setShipping] = useState<ShippingInfo | null>(null)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [assignment, setAssignment] = useState<DeliveryAssignment | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [showThermalModal, setShowThermalModal] = useState(false)

  useEffect(() => {
    if (!order) return
    setShipping(getShippingInfo(order.id))
    setAssignment(getAssignment(order.id))
    setSelectedStaffId('')
    setShowAssignForm(false)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [order, onClose])

  if (!order) return null

  const activeStaff = getActiveStaff()

  const handleAssign = () => {
    if (!selectedStaffId) return
    const staff = getDeliveryStaff().find((s) => s.id === selectedStaffId)
    if (!staff) return
    const a = assignDeliveryStaff(order.id, staff)
    setAssignment(a)
    setShowAssignForm(false)
    setSelectedStaffId('')
    onDeliveryAssign?.(order.id, staff)
  }

  const handleUnassign = () => {
    unassignDelivery(order.id)
    setAssignment(null)
    setShowAssignForm(false)
    setSelectedStaffId('')
    onDeliveryUnassign?.(order.id)
  }

  const handlePrint = () => {
    setShowInvoiceModal(true)
  }

  const handlePrintThermalSlip = () => {
    setShowThermalModal(true)
  }

  const buildOrderThermalData = (): ReceiptData => {
    const subtotal = order.lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)
    const extra = Math.max(0, order.total - subtotal)
    const tax = Math.round(extra * 0.7)
    const deliveryFee = extra - tax
    return {
      orderId: order.id,
      date: order.date,
      cashierName: 'Store',
      customerName: resolveCustomerName(order, customers),
      customerPhone: order.phone,
      items: order.lineItems.map((li) => ({ name: li.name, quantity: li.quantity, unitPrice: li.unitPrice })),
      subtotal,
      discount: 0,
      tax,
      deliveryFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
    }
  }

  const handlePrintLabel = () => {
    if (!shipping) return
    setShowLabelModal(true)
  }

  const handleShippingSave = async (info: ShippingInfo) => {
    saveShippingInfo(info)
    setShipping(info)
    setShippingOpen(false)
    onShippingUpdate?.(order.id, info)
  }

  const handleWhatsAppShare = () => {
    if (!shipping) return
    const url = buildWhatsAppUrl(order, shipping)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleTrackShipment = () => {
    if (!shipping) return
    const url = getTrackingUrlForShipment(shipping)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-2xl animate-slide-in-right sm:max-w-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Order</p>
            <h2 className="font-display text-xl font-bold text-slate-900">{order.id}</h2>
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
          {/* Status + date */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-400">Order Date</p>
              <p className="text-sm font-semibold text-slate-900">{order.date}</p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs font-medium text-slate-400">Status</p>
              <StatusDropdown status={order.status} onChange={(s) => onStatusChange(order.id, s)} />
            </div>
          </div>

          {/* Shipping & Logistics */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Truck className="h-3.5 w-3.5" />
              </span>
              Shipping &amp; Logistics
            </h3>

            {/* Delivery Staff Assignment */}
            <div className="mb-3 rounded-xl border border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Bike className="h-3.5 w-3.5" /> Delivery Staff Assignment
              </div>
              {assignment ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                      <Bike className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{assignment.staffName}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="h-3 w-3" /> {assignment.staffPhone}
                      </p>
                      {assignment.vehicle && (
                        <p className="mt-0.5 font-mono text-xs text-slate-400">{assignment.vehicle}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                      Out for Delivery
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowAssignForm(true); setSelectedStaffId('') }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <UserCog className="h-3.5 w-3.5" /> Change Driver
                    </button>
                    <button
                      onClick={handleUnassign}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Unassign
                    </button>
                  </div>
                </div>
              ) : showAssignForm ? (
                <div className="space-y-2.5 animate-fade-in">
                  {activeStaff.length > 0 ? (
                    <>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="input-field"
                      >
                        <option value="">Select Delivery Driver…</option>
                        {activeStaff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {s.vehicle || 'No vehicle'}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAssign}
                          disabled={!selectedStaffId}
                          className="flex items-center gap-1.5 rounded-lg bg-[#9f0f0f] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#880d0d] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Bike className="h-3.5 w-3.5" /> Assign Staff
                        </button>
                        <button
                          onClick={() => { setShowAssignForm(false); setSelectedStaffId('') }}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-slate-500">No delivery staff added yet.</p>
                      <Link
                        to="/settings"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#9f0f0f] hover:underline"
                      >
                        <UserCog className="h-3.5 w-3.5" /> Add Delivery Staff in Settings
                      </Link>
                    </div>
                  )}
                  {activeStaff.length > 0 && (
                    <Link
                      to="/settings"
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                    >
                      <UserCog className="h-3 w-3" /> + Manage Staff
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAssignForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand"
                >
                  <Bike className="h-4 w-4" /> Assign Delivery Staff
                </button>
              )}
            </div>

            {shipping ? (
              <div className="space-y-3 rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Courier</p>
                    <p className="text-sm font-semibold text-slate-900">{shipping.courier}</p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    Shipped
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">AWB / Tracking</p>
                    <p className="font-mono text-sm text-slate-900">{shipping.awb}</p>
                  </div>
                </div>
                {shipping.estimatedDelivery && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Est. Delivery</p>
                      <p className="text-sm text-slate-700">
                        {new Date(shipping.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={handleTrackShipment}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Track Shipment
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={handlePrintLabel}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <QrCodeIcon className="h-3.5 w-3.5" /> Print Label
                  </button>
                  <button
                    onClick={() => setShippingOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Truck className="h-3.5 w-3.5" /> Update
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                <p className="text-sm text-slate-400">No shipping info yet.</p>
                <button
                  onClick={() => setShippingOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
                >
                  <Truck className="h-4 w-4" /> Ship Order
                </button>
              </div>
            )}
          </section>

          {/* Customer */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Package className="h-3.5 w-3.5" />
              </span>
              Customer
            </h3>
            <div className="space-y-2 rounded-xl border border-slate-100 p-4 text-sm">
              <p className="font-semibold text-slate-900">{resolveCustomerName(order, customers)}</p>
              <p className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" /> {order.email}
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" /> {order.phone}
              </p>
            </div>
          </section>

          {/* Addresses */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              Addresses
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Billing</p>
                <p className="leading-relaxed text-slate-700">{order.billingAddress}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Shipping</p>
                <p className="leading-relaxed text-slate-700">{order.shippingAddress}</p>
              </div>
            </div>
          </section>

          {/* Items */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Receipt className="h-3.5 w-3.5" />
              </span>
              Items Purchased
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.lineItems.map((item) => (
                    <tr key={item.productId} className="align-middle">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                            {item.thumbnail}
                          </span>
                          <span className="font-medium text-slate-800">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Order Total
                    </td>
                    <td className="px-3 py-2.5 text-right font-display text-base font-bold text-brand">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Payment */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              Payment
            </h3>
            <div className="space-y-2 rounded-xl border border-slate-100 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payment Status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    order.payment === 'Paid'
                      ? 'bg-green-50 text-green-700'
                      : order.payment === 'Pending'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {order.payment}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-medium text-slate-800">{order.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-xs text-slate-700">{order.transactionId}</span>
              </div>
            </div>
          </section>

          {/* Status badge summary */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-500">Current status</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[order.status]}`}>
              {order.status}
            </span>
          </div>

          {/* Print buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" /> Print Invoice
            </button>
            <button
              onClick={handlePrintThermalSlip}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#9f0f0f] px-5 py-3 text-sm font-semibold text-[#9f0f0f] transition hover:bg-[#9f0f0f]/5 active:scale-[0.98]"
            >
              <Receipt className="h-4 w-4" /> Thermal Slip
            </button>
          </div>
        </div>
      </div>

      <ShippingModal
        open={shippingOpen}
        orderId={order.id}
        existing={shipping}
        onClose={() => setShippingOpen(false)}
        onSave={handleShippingSave}
      />

      {showInvoiceModal && (
        <InvoiceModal order={order} customers={customers} onClose={() => setShowInvoiceModal(false)} />
      )}

      {showLabelModal && shipping && (
        <ShippingLabelModal order={order} shipping={shipping} onClose={() => setShowLabelModal(false)} />
      )}

      {showThermalModal && (
        <ThermalReceiptModal
          open={showThermalModal}
          data={buildOrderThermalData()}
          onClose={() => setShowThermalModal(false)}
        />
      )}
    </div>
  )
}

/* ---------------- Invoice Modal ---------------- */

function InvoiceModal({ order, customers, onClose }: { order: Order; customers: Customer[]; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const storeProfile = getStoreProfile()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const customerName = resolveCustomerName(order, customers)
  const subtotal = order.lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)
  const extra = Math.max(0, order.total - subtotal)
  const tax = Math.round(extra * 0.7)
  const shippingFee = extra - tax

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-invoice-content')
    if (!element || downloading) return
    setDownloading(true)
    setError('')
    try {
      await generatePdfFromElement(
        element,
        `Invoice_${order.id.replace('#', '')}.pdf`,
        'portrait',
        'a4',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const handleQuickPrint = () => {
    quickPrintElement('printable-invoice-content')
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Modal Header (not part of PDF) */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Invoice</p>
            <h2 className="font-display text-xl font-bold text-slate-900">Tax Invoice {order.id}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Invoice content — captured for PDF */}
        <div ref={invoiceRef} id="printable-invoice-content" className="bg-white px-6 py-6">
          {/* Brand header */}
          <div className="mb-6 flex items-start justify-between border-b-[3px] border-[#9f0f0f] pb-5">
            <div className="flex items-center gap-3">
              <img
                src={storeProfile.logoUrl.trim() || '/zubkas-logo.png'}
                alt={storeProfile.businessName}
                crossOrigin="anonymous"
                className="h-12 w-auto rounded-lg object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.onerror = null
                  img.src = '/zubkas-logo.png'
                }}
              />
              <div>
                <p className="font-display text-xl font-extrabold text-[#9f0f0f]">{storeProfile.businessName}</p>
                <p className="text-xs text-slate-500">{storeProfile.storeAddress}</p>
                <p className="text-xs text-slate-500">{storeProfile.supportPhone} · {storeProfile.supportEmail}</p>
                {storeProfile.gstin && (
                  <p className="text-xs font-mono text-slate-400">GSTIN: {storeProfile.gstin}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-slate-900">TAX INVOICE</p>
              <p className="text-sm text-slate-500">Invoice No: {order.id}</p>
              <p className="text-xs text-slate-400">{order.date}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  order.payment === 'Paid'
                    ? 'bg-green-50 text-green-700'
                    : order.payment === 'Pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {order.payment}
              </span>
            </div>
          </div>

          {/* Billed To */}
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Billed To</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                <p className="mb-1 font-semibold text-slate-900">{customerName}</p>
                <p>{order.phone || '—'}</p>
                <p>{order.email || '—'}</p>
                <p className="mt-2">{order.billingAddress || '—'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                <p className="mb-1 font-semibold text-slate-900">Shipping Address</p>
                <p>{order.shippingAddress || '—'}</p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Items</p>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.lineItems.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 ml-auto w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
              )}
              {shippingFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="font-medium">{formatCurrency(shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-[#9f0f0f] pt-3 text-lg font-bold text-[#9f0f0f]">
                <span>Total Amount</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Status */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              <p className="mb-1 font-semibold text-slate-900">Payment Method</p>
              <p>{order.paymentMethod}</p>
              <p>Status: {order.payment}</p>
              <p className="font-mono text-xs">Txn: {order.transactionId}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              <p className="mb-1 font-semibold text-slate-900">Order Status</p>
              <p>{order.status}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
            <p>© {new Date().getFullYear()} ZUBKAS STOREPULSE. All rights reserved.</p>
          </div>
        </div>

        {/* Footer Actions (not part of PDF) */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          <button
            onClick={handleQuickPrint}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Quick Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF Invoice
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Shipping Label Modal ---------------- */

function ShippingLabelModal({ order, shipping, onClose }: { order: Order; shipping: ShippingInfo; onClose: () => void }) {
  const labelRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const storeProfile = getStoreProfile()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const customerName = resolveCustomerName(order, [])
  const isCod = order.payment === 'Pending' || order.paymentMethod.toLowerCase().includes('cod')
  const paymentLabel = isCod ? 'COD' : 'Prepaid'

  // simple barcode visual
  const barcodeBars: React.ReactNode[] = []
  const code = order.id.replace(/[^A-Z0-9]/gi, '')
  let barX = 0
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i)
    for (let b = 0; b < 4; b++) {
      const w = ((charCode >> b) & 1) ? 3 : 1
      if (b % 2 === 0) {
        barcodeBars.push(
          <rect key={`${i}-${b}`} x={barX} y={0} width={w} height={50} fill="#0f172a" />,
        )
      }
      barX += w + 1
    }
  }

  const handleDownloadLabel = async () => {
    if (!labelRef.current || downloading) return
    setDownloading(true)
    setError('')
    try {
      await generatePdfFromElement(
        labelRef.current,
        `${storeProfile.businessName}_Label_${order.id.replace('#', '')}.pdf`,
        'portrait',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const handlePrintLabel = async () => {
    if (!labelRef.current || downloading) return
    setDownloading(true)
    setError('')
    try {
      await generatePdfFromElement(
        labelRef.current,
        `${storeProfile.businessName}_Label_${order.id.replace('#', '')}.pdf`,
        'portrait',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to print.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Label</p>
            <h2 className="font-display text-xl font-bold text-slate-900">Shipping Label {order.id}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Label content — 4x6 inch format, captured for PDF */}
        <div className="p-5">
          <div ref={labelRef} className="mx-auto rounded-xl border-2 border-slate-200 bg-white p-5" style={{ width: '4in', minHeight: '5in' }}>
            {/* Brand bar */}
            <div className="mb-3 flex items-center justify-between rounded-lg bg-[#9f0f0f] px-3 py-2 text-white">
              <span className="font-display text-sm font-extrabold">{storeProfile.businessName}</span>
              <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#9f0f0f]">
                {paymentLabel} · {formatCurrency(order.total)}
              </span>
            </div>

            {/* From / To */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#9f0f0f]">Ship From</p>
                <p className="text-xs font-bold text-slate-900">{storeProfile.businessName}</p>
                <p className="text-[11px] leading-tight text-slate-600">{storeProfile.storeAddress}</p>
                <p className="mt-1 text-[11px] text-slate-500">{storeProfile.supportPhone}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#9f0f0f]">Ship To</p>
                <p className="text-xs font-bold text-slate-900">{customerName}</p>
                <p className="text-[11px] leading-tight text-slate-600">{order.shippingAddress || order.billingAddress}</p>
                <p className="mt-1 text-[11px] text-slate-500">{order.phone}</p>
              </div>
            </div>

            {/* Courier info */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{shipping.courier}</span>
                <span className="font-mono text-[11px] text-slate-600">AWB: {shipping.awb}</span>
              </div>
              {shipping.estimatedDelivery && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Est. Delivery: {new Date(shipping.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>Order ID: <strong className="text-slate-700">{order.id}</strong></span>
                <span>{order.date}</span>
              </div>
            </div>

            {/* Barcode */}
            <div className="border-t border-b border-dashed border-slate-300 py-3 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width={barX} height={50} viewBox={`0 0 ${barX} 50`}>
                {barcodeBars}
              </svg>
              <p className="mt-1 font-mono text-sm font-bold tracking-wider text-slate-900">{order.id.replace('#', '')}</p>
            </div>

            {/* Payment */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-[11px] text-slate-600">{order.paymentMethod}</span>
              <span className={`rounded px-2 py-1 text-[11px] font-bold ${isCod ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                {paymentLabel} · {formatCurrency(order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          <button
            onClick={handlePrintLabel}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Print Label
          </button>
          <button
            onClick={handleDownloadLabel}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Label PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
