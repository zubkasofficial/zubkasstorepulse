import { useEffect, useState } from 'react'
import { X, Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, Check, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react'
import OtpInput from '@/components/OtpInput'
import {
  fetchStaffUserByEmail, generateOtp, storeOtpInCloud, verifyOtpInCloud,
  updateStaffUserInCloud, clearOtpInCloud,
} from '@/services/auth'

type ForgotPasswordModalProps = {
  open: boolean
  initialEmail: string
  onClose: () => void
  onResetSuccess: (email: string) => void
}

type Step = 'email' | 'reset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordModal({ open, initialEmail, onClose, onResetSuccess }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('email')
    setEmail(initialEmail)
    setEmailError('')
    setOtp('')
    setOtpError('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setShowNew(false)
    setShowConfirm(false)
    setSubmitting(false)
    setToast(null)
  }, [open, initialEmail])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, submitting])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(t)
  }, [toast])

  if (!open) return null

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!email.trim()) {
      setEmailError('Enter your email address.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError('')
    setSubmitting(true)
    try {
      const user = await fetchStaffUserByEmail(email.trim())
      if (!user) {
        setToast({ type: 'error', message: 'Email address not found. Contact your store admin.' })
        setSubmitting(false)
        return
      }
      const code = generateOtp()
      await storeOtpInCloud(email.trim(), code)
      setSubmitting(false)
      setStep('reset')
      setToast({ type: 'success', message: `Password Reset OTP: ${code}` })
    } catch {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again.' })
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    let hasError = false
    if (otp.length !== 6) {
      setOtpError('Enter all 6 digits.')
      hasError = true
    }
    if (!newPassword) {
      setPasswordError('Enter a new password.')
      hasError = true
    } else if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      hasError = true
    } else if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      hasError = true
    }
    if (hasError) return

    setOtpError('')
    setPasswordError('')
    setSubmitting(true)
    try {
      const ok = await verifyOtpInCloud(email.trim(), otp)
      if (!ok) {
        setOtpError('Incorrect code. Please try again.')
        setToast({ type: 'error', message: 'Incorrect OTP. Please try again.' })
        setSubmitting(false)
        return
      }
      const user = await fetchStaffUserByEmail(email.trim())
      if (user) {
        await updateStaffUserInCloud(user.id, { password: newPassword })
      }
      await clearOtpInCloud(email.trim())
      setSubmitting(false)
      setToast({ type: 'success', message: 'Password reset successful! You can now sign in.' })
      window.setTimeout(() => {
        onResetSuccess(email.trim())
      }, 1200)
    } catch {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again.' })
      setSubmitting(false)
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setOtp('')
    setOtpError('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setToast(null)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ fontFamily: "'Noto Serif Ethiopic', serif" }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {step === 'email' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {step === 'email' ? 'Reset Password' : 'Verify & Set Password'}
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

        {toast && (
          <div
            className={`mx-6 mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm animate-fade-in ${
              toast.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        )}

        <div className="overflow-y-auto p-6">
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
              <p className="text-sm text-slate-500">
                Enter your registered email and we'll send you a one-time code to reset your password.
              </p>
              <div>
                <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                    placeholder="you@company.com"
                    className="input-field pl-10"
                  />
                </div>
                {emailError && <p className="mt-1.5 text-sm text-red-600">{emailError}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</>
                ) : (
                  <>Send Reset Code <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div className="rounded-xl bg-[#9f0f0f]/5 px-4 py-3 text-sm text-[#9f0f0f]">
                Code sent to <span className="font-semibold">{email}</span>.{' '}
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="font-medium underline underline-offset-2 hover:text-[#880d0d]"
                >
                  Change email
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Enter 6-digit code</label>
                <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError('') }} disabled={submitting} />
                {otpError && <p className="mt-2 text-sm text-red-600">{otpError}</p>}
              </div>

              <div>
                <label htmlFor="fp-new-pass" className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="fp-new-pass"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                    placeholder="••••••••"
                    className="input-field px-10"
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
              </div>

              <div>
                <label htmlFor="fp-confirm-pass" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="fp-confirm-pass"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
                    placeholder="••••••••"
                    className="input-field px-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && <p className="mt-1.5 text-sm text-red-600">{passwordError}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>
                ) : (
                  <>Reset Password <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
