import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader as Loader2, Check, Download, Share } from 'lucide-react'
import OtpInput from '../components/OtpInput'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import { useAuth } from '../auth/AuthContext'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import {
  fetchStaffUserByEmail,
  permissionsForRole,
} from '@/services/auth'
import { defaultRouteForPermissions } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'

type Tab = 'password' | 'otp'

const RESEND_SECONDS = 30
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FEATURES = [
  'Real-time revenue, order tracking & store health',
  'Manage products, stock & pricing in seconds',
  'Seamless WooCommerce store integration',
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [tab, setTab] = useState<Tab>('password')

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const [otpRequested, setOtpRequested] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const timerRef = useRef<number | null>(null)

  const [forgotOpen, setForgotOpen] = useState(false)
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const [showIosHint, setShowIosHint] = useState(false)

  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !((navigator as unknown as { standalone?: boolean }).standalone)
  const showInstallButton = !installed && (canInstall || isIos())

  const handleInstallClick = async () => {
    if (canInstall) {
      await promptInstall()
    } else if (isIos()) {
      setShowIosHint(true)
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 450)
  }

  const startResendTimer = () => {
    setResendIn(RESEND_SECONDS)
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError('Enter your email address.')
      return false
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address.')
      return false
    }
    setEmailError('')
    return true
  }

  const redirectToRoleHome = (role: string) => {
    const perms = permissionsForRole(role)
    const route = defaultRouteForPermissions(perms)
    navigate(route, { replace: true })
  }

  /* ---------------- Password login (live Supabase) ---------------- */

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const okEmail = validateEmail()
    if (!okEmail) {
      triggerShake()
      return
    }

    let okPass = true
    if (!password) {
      setPasswordError('Enter your password.')
      okPass = false
    } else if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters.')
      okPass = false
    } else {
      setPasswordError('')
    }
    if (!okPass) {
      triggerShake()
      return
    }

    setSubmitting(true)
    try {
      const user = await fetchStaffUserByEmail(email.trim())
      if (!user) {
        setToast({ type: 'error', message: 'Email not registered. Please contact your store administrator.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      if (user.status !== 'active') {
        setToast({ type: 'error', message: 'Account is disabled. Contact Admin.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      if (user.password !== password) {
        setPasswordError('Invalid password.')
        setToast({ type: 'error', message: 'Invalid password.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      login(user, 'password')
      redirectToRoleHome(user.role)
    } catch {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again.' })
      triggerShake()
      setSubmitting(false)
    }
  }

  /* ---------------- OTP login (live Supabase) ---------------- */

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!validateEmail()) {
      triggerShake()
      return
    }

    setSubmitting(true)
    try {
      const user = await fetchStaffUserByEmail(email.trim())
      if (!user) {
        setToast({ type: 'error', message: 'Email not registered. Only approved store staff can sign in.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      if (user.status !== 'active') {
        setToast({ type: 'error', message: 'Account is disabled. Contact Admin.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (error) {
        setToast({ type: 'error', message: error.message })
        triggerShake()
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      setOtpRequested(true)
      setOtp('')
      setOtpError('')
      startResendTimer()
      setToast({ type: 'success', message: 'A 6-digit code has been sent to your email.' })
    } catch {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again.' })
      triggerShake()
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0) return
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    setSubmitting(false)
    if (error) {
      setToast({ type: 'error', message: error.message })
      return
    }
    setOtp('')
    setOtpError('')
    startResendTimer()
    setToast({ type: 'success', message: 'A new 6-digit code has been sent to your email.' })
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (otp.length !== 6) {
      setOtpError('Enter all 6 digits.')
      triggerShake()
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email',
      })
      if (error) {
        setOtpError('Invalid verification code. Please check your email.')
        setToast({ type: 'error', message: 'Invalid verification code. Please check your email.' })
        triggerShake()
        setSubmitting(false)
        return
      }
      const user = await fetchStaffUserByEmail(email.trim())
      if (!user) {
        setToast({ type: 'error', message: 'Email not registered. Please contact your store administrator.' })
        setSubmitting(false)
        return
      }
      login(user, 'otp')
      redirectToRoleHome(user.role)
    } catch {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again.' })
      triggerShake()
      setSubmitting(false)
    }
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    setEmailError('')
    setPasswordError('')
    setOtpError('')
    setOtpRequested(false)
    setOtp('')
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setResendIn(0)
  }

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2">
      {/* Left Half — Brand Showcase */}
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-[#9f0f0f] via-[#7d0b0b] to-[#4a0606] px-8 py-10 lg:px-16 lg:py-14">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-6 flex items-center gap-3.5">
            <img
              src="/zubkas_icon_hd_white.png"
              alt="Zubkas StorePulse"
              className="h-8 w-auto inline-block mr-2 align-middle shrink-0 object-contain"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.onerror = null
                img.src = '/icon-512.svg'
              }}
            />
            <span className="font-['Noto_Serif'] text-lg font-semibold tracking-tight text-white">Zubkas StorePulse</span>
          </div>

          <h1 className="font-display text-3xl font-bold leading-tight text-white lg:text-4xl">
            Zubkas StorePulse
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/80">
            The modern WooCommerce store portal for growing brands.
          </p>

          <ul className="mt-10 max-w-md space-y-4">
            {FEATURES.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/90 lg:text-base">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3.5 w-3.5 text-white" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-xs text-white/50">© 2026 ZUBKAS STOREPULSE</p>
      </div>

      {/* Right Half — Sign-in Form */}
      <div className="flex items-center justify-center bg-white px-6 py-10 lg:px-8">
        <div className="max-w-md w-full mx-auto p-4 sm:p-8">
          {toast && (
            <div
              className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm animate-fade-in ${
                toast.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {toast.type === 'success' ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-red-500" />
              )}
              <span className="flex-1">{toast.message}</span>
            </div>
          )}

          <div className={shake ? 'animate-shake' : 'animate-scale-in'}>
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Sign in to access your store portal.</p>
            </div>

            <div className="relative mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchTab('password')}
                className={`tab-btn rounded-lg ${tab === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Email &amp; Password
              </button>
              <button
                type="button"
                onClick={() => switchTab('otp')}
                className={`tab-btn rounded-lg ${tab === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Email OTP
              </button>
            </div>

            {tab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in" noValidate>
                <Field label="Email" error={emailError} htmlFor="email">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={validateEmail}
                    placeholder="you@company.com"
                    className="input-field pl-10"
                  />
                </Field>

                <Field label="Password" error={passwordError} htmlFor="password">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field px-10"
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

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#9f0f0f] focus:ring-[#9f0f0f]/20" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-sm font-medium text-[#9f0f0f] hover:text-[#880d0d]"
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={submitting} className="sign-in-btn w-full !bg-[#9f0f0f] hover:!bg-[#850c0c]">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {tab === 'otp' && (
              <div className="animate-fade-in">
                {!otpRequested ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
                    <Field label="Email" error={emailError} htmlFor="otp-email">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="otp-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={validateEmail}
                        placeholder="you@company.com"
                        className="input-field pl-10"
                      />
                    </Field>

                    <button type="submit" disabled={submitting} className="sign-in-btn w-full !bg-[#9f0f0f] hover:!bg-[#850c0c]">
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
                        </>
                      ) : (
                        <>
                          Send code <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-400">
                      We'll email you a one-time code valid for 10 minutes.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleOtpVerify} className="space-y-5" noValidate>
                    <div className="rounded-xl bg-[#9f0f0f]/5 px-4 py-3 text-sm text-[#9f0f0f]">
                      Code sent to <span className="font-semibold">{email}</span>.{' '}
                      <button
                        type="button"
                        onClick={() => switchTab('otp')}
                        className="font-medium underline underline-offset-2 hover:text-[#880d0d]"
                      >
                        Change email
                      </button>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Enter 6-digit code</label>
                      <OtpInput value={otp} onChange={setOtp} disabled={submitting} />
                      {otpError && <p className="mt-2 text-sm text-red-600">{otpError}</p>}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Didn't get it?</span>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendIn > 0}
                        className="font-medium text-[#9f0f0f] hover:text-[#880d0d] disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                      </button>
                    </div>

                    <button type="submit" disabled={submitting} className="sign-in-btn w-full !bg-[#9f0f0f] hover:!bg-[#850c0c]">
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                        </>
                      ) : (
                        <>
                          Verify &amp; sign in <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {showInstallButton && (
            <button
              onClick={handleInstallClick}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#9f0f0f] px-5 py-3 text-sm font-semibold text-[#9f0f0f] transition hover:bg-[#9f0f0f]/5 active:scale-[0.98]"
            >
              <Download className="h-4 w-4" /> Install Zubkas App
            </button>
          )}

          {showIosHint && (
            <div className="mt-4 rounded-xl border border-[#9f0f0f]/20 bg-[#9f0f0f]/5 px-4 py-3 text-sm text-[#9f0f0f] animate-fade-in">
              <p className="flex items-start gap-2">
                <Share className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tap the <strong>Share</strong> button in Safari, then <strong>“Add to Home Screen”</strong> to install the app.</span>
              </p>
            </div>
          )}

          <p className="mt-10 text-center text-xs text-slate-400">
            Powered by ZUBKAS
          </p>

          {forgotOpen && (
            <ForgotPasswordModal
              open={forgotOpen}
              initialEmail={email}
              onClose={() => setForgotOpen(false)}
              onResetSuccess={(resetEmail) => {
                setForgotOpen(false)
                setEmail(resetEmail)
                setPassword('')
                setTab('password')
                setToast({ type: 'success', message: 'Password reset successful! You can now sign in.' })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">{children}</div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}
