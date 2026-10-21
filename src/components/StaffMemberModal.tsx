import { useEffect, useState } from 'react'
import { X, Loader as Loader2, Check, User, Eye, EyeOff, Mail, Phone, Lock, ShieldCheck, Store, Bike, CircleAlert as AlertCircle } from 'lucide-react'
import { type Role, type AccountStatus } from '@/services/auth'

type StaffMemberModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  member?: { id: string; name: string; email: string; password: string; role: Role; phone: string; status: AccountStatus; createdAt: string } | null
  onClose: () => void
  onSave: (data: { name: string; email: string; password: string; role: Role; phone: string; status: AccountStatus }) => Promise<boolean>
}

type FormState = {
  name: string
  email: string
  password: string
  role: Role
  phone: string
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'cashier',
  phone: '',
}

const ROLES: { value: Role; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: 'store_manager', label: 'Store Manager', icon: Store, desc: 'Dashboard, POS, orders, products & reports' },
  { value: 'cashier', label: 'Cashier', icon: ShieldCheck, desc: 'POS Terminal and Orders' },
  { value: 'delivery_driver', label: 'Delivery Driver', icon: Bike, desc: 'Delivery Hub only' },
]

export default function StaffMemberModal({ open, mode, member, onClose, onSave }: StaffMemberModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && member) {
      setForm({
        name: member.name,
        email: member.email,
        password: member.password,
        role: member.role,
        phone: member.phone,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setShowPassword(false)
    setSuccess(false)
  }, [open, mode, member])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  if (!open) return null

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Enter the full name.'
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim()) next.email = 'Enter the email address.'
    else if (!emailRe.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (mode === 'create' && !form.password.trim()) next.password = 'Enter a password.'
    else if (form.password && form.password.length < 6) next.password = 'Password must be at least 6 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    setErrors((prev) => ({ ...prev, _form: '' }))
    try {
      const ok = await onSave({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim(),
        status: 'active',
      })
      if (!ok) {
        setSaving(false)
        return
      }
      setSaving(false)
      setSuccess(true)
      window.setTimeout(() => {
        setForm(EMPTY_FORM)
        setErrors({})
        onClose()
      }, 900)
    } catch (err) {
      setSaving(false)
      setErrors((prev) => ({ ...prev, _form: err instanceof Error ? err.message : 'Failed to save member.' }))
    }
  }

  const handleClose = () => {
    if (saving) return
    setForm(EMPTY_FORM)
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {mode === 'edit' ? 'Edit Member' : 'New Team Member'}
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900" style={{ fontFamily: "'Noto Serif Ethiopic', serif" }}>
              {mode === 'edit' ? 'Edit Member' : 'Add New Member'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-fade-in">
            <Check className="h-4 w-4 shrink-0" /> New member added successfully!
          </div>
        )}
        {errors._form && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{errors._form}</span>
          </div>
        )}

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6" noValidate style={{ fontFamily: "'Noto Serif Ethiopic', serif" }}>
          <Field label="Full Name" htmlFor="sm-name" error={errors.name}>
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sm-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-field pl-10"
              placeholder="e.g. Ramesh Kumar"
            />
          </Field>

          <Field label="Email Address" htmlFor="sm-email" error={errors.email}>
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sm-email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="input-field pl-10"
              placeholder="member@zubkas.com"
            />
          </Field>

          <Field label="Password" htmlFor="sm-password" error={errors.password} hint={mode === 'edit' ? 'Leave blank to keep current' : undefined}>
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sm-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="input-field px-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ROLES.map((r) => {
                const Icon = r.icon
                const active = form.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update('role', r.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
                      active ? 'border-[#9f0f0f] bg-[#9f0f0f]/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-[#9f0f0f] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`text-sm font-medium ${active ? 'text-[#9f0f0f]' : 'text-slate-800'}`}>{r.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Phone Number" htmlFor="sm-phone" hint="Optional">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sm-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="input-field pl-10"
              placeholder="9876543210"
            />
          </Field>
        </form>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <>Save &amp; Create Member</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
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
