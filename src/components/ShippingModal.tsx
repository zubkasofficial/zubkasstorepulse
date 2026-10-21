import { useEffect, useMemo, useState } from 'react'
import {
  X, Truck, Loader as Loader2, Sparkles, Calendar, Hash, Building2,
  CircleCheck as CheckCircle2, Link as LinkIcon, Plus,
} from 'lucide-react'
import {
  getCourierPartners, resolveTrackingUrl, type CourierPartner, type ShippingInfo,
} from '@/lib/shipping'

type ShippingModalProps = {
  open: boolean
  orderId: string
  existing: ShippingInfo | null
  onClose: () => void
  onSave: (info: ShippingInfo) => Promise<void>
}

const CUSTOM_ID = '__custom__'

type FormState = {
  partnerId: string
  customCourierName: string
  awb: string
  trackingUrl: string
  estimatedDelivery: string
}

const EMPTY_FORM: FormState = {
  partnerId: '',
  customCourierName: '',
  awb: '',
  trackingUrl: '',
  estimatedDelivery: '',
}

export default function ShippingModal({ open, orderId, existing, onClose, onSave }: ShippingModalProps) {
  const [partners, setPartners] = useState<CourierPartner[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [trackingUrlTouched, setTrackingUrlTouched] = useState(false)
  const [errors, setErrors] = useState<{ awb?: string; customCourierName?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPartners(getCourierPartners())
      setTrackingUrlTouched(false)
      if (existing) {
        const match = getCourierPartners().find((p) => p.name === existing.courier)
        setForm({
          partnerId: match ? match.id : CUSTOM_ID,
          customCourierName: match ? '' : existing.courier,
          awb: existing.awb,
          trackingUrl: existing.trackingUrl,
          estimatedDelivery: existing.estimatedDelivery,
        })
        setTrackingUrlTouched(!!existing.trackingUrl)
      } else {
        setForm(EMPTY_FORM)
      }
      setErrors({})
    }
  }, [open, existing])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === form.partnerId) ?? null,
    [partners, form.partnerId],
  )

  const isCustom = form.partnerId === CUSTOM_ID

  const autoTrackingUrl = useMemo(() => {
    if (isCustom) return form.trackingUrl
    if (selectedPartner && form.awb.trim()) {
      return resolveTrackingUrl(selectedPartner.trackingUrlTemplate, form.awb)
    }
    return ''
  }, [isCustom, selectedPartner, form.awb, form.trackingUrl])

  const effectiveTrackingUrl = trackingUrlTouched ? form.trackingUrl : autoTrackingUrl

  if (!open) return null

  const validate = () => {
    const next: typeof errors = {}
    if (!form.awb.trim()) next.awb = 'Enter the AWB / tracking number.'
    if (isCustom && !form.customCourierName.trim()) {
      next.customCourierName = 'Enter the courier partner name.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    try {
      const courierName = isCustom ? form.customCourierName.trim() : (selectedPartner?.name ?? '')
      await onSave({
        orderId,
        courier: courierName,
        awb: form.awb.trim(),
        trackingUrl: effectiveTrackingUrl,
        estimatedDelivery: form.estimatedDelivery,
        shippedAt: existing?.shippedAt ?? new Date().toISOString(),
      })
    } catch {
      /* handled by parent */
    } finally {
      setSaving(false)
    }
  }

  const generateAwb = () => {
    const chars = '0123456789'
    let out = ''
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
    setForm((f) => ({ ...f, awb: out }))
    setTrackingUrlTouched(false)
  }

  const handleAwbChange = (value: string) => {
    setForm((f) => ({ ...f, awb: value }))
    setTrackingUrlTouched(false)
  }

  const handleTrackingUrlChange = (value: string) => {
    setForm((f) => ({ ...f, trackingUrl: value }))
    setTrackingUrlTouched(true)
  }

  const handlePartnerChange = (value: string) => {
    setForm((f) => ({ ...f, partnerId: value, customCourierName: '' }))
    setTrackingUrlTouched(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Order {orderId}</p>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {existing ? 'Update Shipping' : 'Ship Order'}
              </h2>
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Courier partner */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-400" /> Courier Partner
            </label>
            <select
              value={form.partnerId}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="input-field"
            >
              <option value="">Select a courier partner…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value={CUSTOM_ID}>Custom / Other</option>
            </select>
          </div>

          {/* Custom courier name */}
          {isCustom && (
            <div className="animate-fade-in">
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Plus className="h-3.5 w-3.5 text-slate-400" /> Courier Name
              </label>
              <input
                value={form.customCourierName}
                onChange={(e) => setForm((f) => ({ ...f, customCourierName: e.target.value }))}
                className="input-field"
                placeholder="e.g. Shadowfax"
              />
              {errors.customCourierName && <p className="mt-1.5 text-sm text-red-600">{errors.customCourierName}</p>}
            </div>
          )}

          {/* AWB */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Hash className="h-3.5 w-3.5 text-slate-400" /> AWB / Tracking Number
            </label>
            <div className="flex gap-2">
              <input
                value={form.awb}
                onChange={(e) => handleAwbChange(e.target.value)}
                className="input-field font-mono"
                placeholder="AWB1234567890"
              />
              <button
                type="button"
                onClick={generateAwb}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Sparkles className="h-4 w-4 text-brand" /> Auto
              </button>
            </div>
            {errors.awb && <p className="mt-1.5 text-sm text-red-600">{errors.awb}</p>}
          </div>

          {/* Tracking URL */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <LinkIcon className="h-3.5 w-3.5 text-slate-400" /> Tracking URL
              <span className="text-xs font-normal text-slate-400">(auto-filled, editable)</span>
            </label>
            <input
              type="url"
              value={effectiveTrackingUrl}
              onChange={(e) => handleTrackingUrlChange(e.target.value)}
              className="input-field text-sm"
              placeholder={
                selectedPartner && selectedPartner.trackingUrlTemplate
                  ? selectedPartner.trackingUrlTemplate.replace('{tracking_number}', '...')
                  : 'https://track.example.com/AWB1234567890'
              }
            />
            {selectedPartner && !selectedPartner.trackingUrlTemplate && !isCustom && (
              <p className="mt-1.5 text-xs text-slate-400">
                This partner has no tracking URL template. Enter the tracking URL manually above.
              </p>
            )}
          </div>

          {/* Estimated delivery */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> Estimated Delivery Date
            </label>
            <input
              type="date"
              value={form.estimatedDelivery}
              onChange={(e) => setForm((f) => ({ ...f, estimatedDelivery: e.target.value }))}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> {existing ? 'Update Shipping' : 'Ship Order'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
