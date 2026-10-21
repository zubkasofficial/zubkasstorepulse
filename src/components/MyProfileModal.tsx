import { useEffect, useState } from 'react'
import { X, Loader as Loader2, Check, User, Mail, Phone, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useWoo } from '@/auth/WooContext'
import { updateStaffUserInCloud } from '@/services/auth'
import { ROLE_LABELS } from '@/services/auth'

export default function MyProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshSession } = useAuth()
  const { pushToast } = useWoo()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrors({})
    setShowCurrent(false)
    setShowNew(false)
  }, [open, user])

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

  if (!open || !user) return null

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter your full name.'
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!emailRe.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!phone.trim()) next.phone = 'Enter your phone number.'

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) next.currentPassword = 'Enter your current password.'
      if (!newPassword) next.newPassword = 'Enter a new password.'
      else if (newPassword.length < 6) next.newPassword = 'Password must be at least 6 characters.'
      if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving || !user) return
    setSaving(true)
    setErrors((prev) => ({ ...prev, _form: '' }))
    try {
      const patch: Parameters<typeof updateStaffUserInCloud>[1] = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      }
      if (newPassword) {
        patch.password = newPassword
      }
      const ok = await updateStaffUserInCloud(user.id, patch)
      if (!ok) {
        setErrors((prev) => ({ ...prev, _form: 'Failed to update profile. Please try again.' }))
        setSaving(false)
        return
      }
      await refreshSession()
      pushToast('success', 'Profile & Password updated successfully')
      setSaving(false)
      onClose()
    } catch (err) {
      setSaving(false)
      setErrors((prev) => ({ ...prev, _form: err instanceof Error ? err.message : 'Failed to update profile.' }))
    }
  }

  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => !saving && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{roleLabel}</p>
              <h2 className="font-display text-xl font-bold text-slate-900">My Profile &amp; Security</h2>
            </div>
          </div>
          <button
            onClick={() => !saving && onClose()}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errors._form && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{errors._form}</span>
          </div>
        )}

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6" noValidate>
          {/* Avatar + role display */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
              {user.name?.charAt(0) ?? 'U'}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand">
                <ShieldCheck className="h-3 w-3" /> {roleLabel}
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
                className="input-field pl-10"
                placeholder="Enter your full name"
              />
            </div>
            {errors.name && <p className="mt-1.5 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })) }}
                className="input-field pl-10"
                placeholder="you@example.com"
              />
            </div>
            {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: '' })) }}
                className="input-field pl-10"
                placeholder="9876543210"
              />
            </div>
            {errors.phone && <p className="mt-1.5 text-sm text-red-600">{errors.phone}</p>}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Change Password</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Current Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setErrors((p) => ({ ...p, currentPassword: '' })) }}
                className="input-field px-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="mt-1.5 text-sm text-red-600">{errors.currentPassword}</p>}
          </div>

          {/* New Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, newPassword: '' })) }}
                className="input-field px-10"
                placeholder="Leave blank to keep current"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1.5 text-sm text-red-600">{errors.newPassword}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: '' })) }}
                className="input-field px-10"
                placeholder="Re-enter new password"
              />
            </div>
            {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>
        </form>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 transition hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Check className="h-4 w-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
