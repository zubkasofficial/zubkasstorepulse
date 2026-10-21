import { useEffect, useMemo, useState } from 'react'
import {
  Ticket, Plus, RefreshCw, Search, Trash2, Copy, Pencil, X, Loader as Loader2,
  Percent, IndianRupee, Calendar, TrendingDown,
  CircleCheck as CheckCircle2, Sparkles, Tag,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import ConfirmDialog from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/LoadingStates'
import { useWoo } from '@/auth/WooContext'
import {
  fetchCoupons, createCoupon, deleteCoupon, discountTypeLabel,
  type Coupon, type CouponDiscountType, type CreateCouponInput,
} from '@/lib/woocommerce'
import { formatCurrency } from '@/data/mockData'

const DISCOUNT_TYPES: { key: CouponDiscountType; label: string; hint: string }[] = [
  { key: 'percent', label: 'Percentage discount', hint: 'A percentage discount off the order total' },
  { key: 'fixed_cart', label: 'Fixed cart discount', hint: 'A fixed amount off the entire cart' },
  { key: 'fixed_product', label: 'Fixed product discount', hint: 'A fixed amount off selected products' },
]

function isExpired(coupon: Coupon): boolean {
  if (!coupon.expiryDate) return false
  const d = new Date(coupon.expiryDate)
  return !isNaN(d.getTime()) && d.getTime() < Date.now()
}

function isExhausted(coupon: Coupon): boolean {
  return coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit
}

export default function CouponsPage() {
  const { connection, pushToast } = useWoo()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [query, setQuery] = useState('')
  const [fetching, setFetching] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCoupons = async () => {
    if (!connection) {
      setCoupons([])
      return
    }
    setFetching(true)
    try {
      const data = await fetchCoupons(connection)
      setCoupons(data)
    } catch (err) {
      pushToast('error', `Failed to load coupons: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    loadCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  const filtered = useMemo(() => {
    return coupons.filter((c) => c.code.toLowerCase().includes(query.toLowerCase()))
  }, [coupons, query])

  const activeCount = coupons.filter((c) => !isExpired(c) && !isExhausted(c)).length
  const expiredCount = coupons.filter((c) => isExpired(c)).length
  const totalRedeemed = coupons.reduce((sum, c) => sum + (c.amount * c.usageCount), 0)

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => pushToast('success', `Coupon code "${code}" copied to clipboard.`),
      () => pushToast('error', 'Unable to copy to clipboard.'),
    )
  }

  const handleDelete = async () => {
    if (!deleteTarget || !connection) return
    setDeleting(true)
    try {
      await deleteCoupon(connection, deleteTarget.id)
      setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      pushToast('success', `Coupon "${deleteTarget.code}" deleted from your store.`)
      setDeleteTarget(null)
    } catch (err) {
      pushToast('error', `Failed to delete coupon: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleCreate = async (input: CreateCouponInput) => {
    if (!connection) return
    try {
      const created = await createCoupon(connection, input)
      setCoupons((prev) => [created, ...prev])
      pushToast('success', `Coupon "${created.code}" created and synced to your store.`)
      setCreateOpen(false)
    } catch (err) {
      pushToast('error', `Failed to create coupon: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-brand">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Coupon &amp; Discounts</h1>
              <p className="text-sm text-slate-500">Create and manage discount codes for your store.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCoupons}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Create Coupon
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Active Coupons" value={activeCount.toString()} icon={Tag} accent="green" />
          <SummaryCard label="Total Discount Redeemed" value={formatCurrency(totalRedeemed)} icon={TrendingDown} accent="brand" />
          <SummaryCard label="Expired Coupons" value={expiredCount.toString()} icon={Calendar} accent="amber" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by coupon code…"
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {fetching && coupons.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
                  <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">Code</th>
                      <th className="pb-3 pr-4">Discount Type</th>
                      <th className="pb-3 pr-4 text-right">Amount</th>
                      <th className="pb-3 pr-4 text-right">Usage / Limit</th>
                      <th className="pb-3 pr-4">Expiry Date</th>
                      <th className="pb-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((c) => {
                      const expired = isExpired(c)
                      const exhausted = isExhausted(c)
                      return (
                        <tr key={c.id} className="transition hover:bg-slate-50/60">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold text-brand">
                                {c.code}
                              </span>
                              {expired && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                  Expired
                                </span>
                              )}
                              {!expired && exhausted && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Exhausted
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="flex items-center gap-1.5 text-slate-600">
                              {c.discountType === 'percent' ? (
                                <Percent className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              {discountTypeLabel(c.discountType)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-right font-semibold text-slate-900">
                            {c.discountType === 'percent' ? `${c.amount}%` : formatCurrency(c.amount)}
                          </td>
                          <td className="py-3.5 pr-4 text-right text-slate-600">
                            {c.usageCount} / {c.usageLimit > 0 ? c.usageLimit : '∞'}
                          </td>
                          <td className="py-3.5 pr-4 text-slate-500">
                            {c.expiryDate || 'No expiry'}
                          </td>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleCopyCode(c.code)}
                                aria-label="Copy code"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => pushToast('error', 'Coupon editing is coming soon.')}
                                aria-label="Edit coupon"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(c)}
                                aria-label="Delete coupon"
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
                {filtered.map((c) => {
                  const expired = isExpired(c)
                  const exhausted = isExhausted(c)
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-100 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold text-brand">
                          {c.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyCode(c.code)}
                            aria-label="Copy code"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            aria-label="Delete coupon"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-600">
                        {c.discountType === 'percent' ? (
                          <Percent className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        {discountTypeLabel(c.discountType)} ·{' '}
                        <span className="font-semibold text-slate-900">
                          {c.discountType === 'percent' ? `${c.amount}%` : formatCurrency(c.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{c.usageCount} / {c.usageLimit > 0 ? c.usageLimit : '∞'} uses · {c.expiryDate || 'No expiry'}</span>
                        {expired && <span className="font-medium text-slate-500">Expired</span>}
                        {!expired && exhausted && <span className="font-medium text-amber-700">Exhausted</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Ticket}
              title="No coupons yet"
              message="Create your first discount code to start offering promotions to your customers."
              onRefresh={loadCoupons}
            />
          )}
        </div>
      </div>

      <CreateCouponModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete coupon?"
        message={`Coupon "${deleteTarget?.code ?? ''}" will be permanently removed from your store. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AppLayout>
  )
}

/* ---------------- Summary Card ---------------- */

function SummaryCard({
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

/* ---------------- Create Coupon Modal ---------------- */

const EMPTY_FORM = {
  code: '',
  discountType: 'percent' as CouponDiscountType,
  amount: '',
  minimumSpend: '',
  usageLimit: '',
  expiryDate: '',
  freeShipping: false,
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function CreateCouponModal({
  open, onClose, onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: CreateCouponInput) => Promise<void>
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

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

  if (!open) return null

  const update = (field: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.code.trim()) next.code = 'Enter a coupon code.'
    const amountNum = Number(form.amount)
    if (!form.amount.trim()) next.amount = 'Enter a discount amount.'
    else if (isNaN(amountNum) || amountNum <= 0) next.amount = 'Amount must be greater than 0.'
    else if (form.discountType === 'percent' && amountNum > 100) next.amount = 'Percentage cannot exceed 100%.'
    if (form.minimumSpend.trim()) {
      const minNum = Number(form.minimumSpend)
      if (isNaN(minNum) || minNum < 0) next.minimumSpend = 'Enter a valid minimum spend.'
    }
    if (form.usageLimit.trim()) {
      const limitNum = Number(form.usageLimit)
      if (isNaN(limitNum) || limitNum <= 0) next.usageLimit = 'Enter a valid usage limit.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    try {
      await onSave({
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        amount: Number(form.amount),
        minimumSpend: form.minimumSpend.trim() ? Number(form.minimumSpend) : 0,
        usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : 0,
        expiryDate: form.expiryDate || '',
        freeShipping: form.freeShipping,
      })
      setForm(EMPTY_FORM)
      setErrors({})
    } catch {
      // error toast handled by parent
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    setForm(EMPTY_FORM)
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-slide-in-right sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">New Discount</p>
            <h2 className="font-display text-xl font-bold text-slate-900">Create Coupon</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5" noValidate>
          {/* Coupon code */}
          <Field label="Coupon Code" htmlFor="c-code" error={errors.code}>
            <div className="flex gap-2">
              <input
                id="c-code"
                value={form.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                className="input-field font-mono uppercase"
                placeholder="SUMMER20"
              />
              <button
                type="button"
                onClick={() => update('code', generateRandomCode())}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Sparkles className="h-4 w-4 text-brand" /> Random
              </button>
            </div>
          </Field>

          {/* Discount type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Discount Type</label>
            <div className="space-y-2">
              {DISCOUNT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => update('discountType', t.key)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                    form.discountType === t.key
                      ? 'border-brand bg-brand-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    form.discountType === t.key ? 'border-brand bg-brand' : 'border-slate-300'
                  }`}>
                    {form.discountType === t.key && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${form.discountType === t.key ? 'text-brand' : 'text-slate-800'}`}>{t.label}</p>
                    <p className="text-xs text-slate-400">{t.hint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={form.discountType === 'percent' ? 'Amount (%)' : 'Amount (₹)'}
              htmlFor="c-amount"
              error={errors.amount}
            >
              <div className="relative">
                {form.discountType === 'percent' ? (
                  <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                ) : (
                  <IndianRupee className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                )}
                <input
                  id="c-amount"
                  type="number"
                  min="0"
                  step={form.discountType === 'percent' ? '1' : '0.01'}
                  value={form.amount}
                  onChange={(e) => update('amount', e.target.value)}
                  className="input-field pr-10"
                  placeholder={form.discountType === 'percent' ? '20' : '500'}
                />
              </div>
            </Field>
            <Field label="Minimum Spend (₹)" htmlFor="c-min" error={errors.minimumSpend} hint="Optional">
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="c-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumSpend}
                  onChange={(e) => update('minimumSpend', e.target.value)}
                  className="input-field pr-10"
                  placeholder="0"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Usage Limit" htmlFor="c-limit" error={errors.usageLimit} hint="Optional">
              <input
                id="c-limit"
                type="number"
                min="0"
                value={form.usageLimit}
                onChange={(e) => update('usageLimit', e.target.value)}
                className="input-field"
                placeholder="100"
              />
            </Field>
            <Field label="Expiry Date" htmlFor="c-expiry" hint="Optional">
              <input
                id="c-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => update('expiryDate', e.target.value)}
                className="input-field"
              />
            </Field>
          </div>

          {/* Free shipping toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Free shipping</p>
              <p className="text-xs text-slate-400">Allow this coupon to grant free shipping</p>
            </div>
            <button
              type="button"
              onClick={() => update('freeShipping', !form.freeShipping)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                form.freeShipping ? 'bg-brand' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.freeShipping ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Save &amp; Publish to Store</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---------------- Field ---------------- */

function Field({
  label, htmlFor, error, hint, children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="relative">{children}</div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}
