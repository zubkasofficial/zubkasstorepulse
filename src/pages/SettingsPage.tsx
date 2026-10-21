import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader as Loader2, CircleCheck as CheckCircle2, Phone, Building2, ArrowRight, ShieldCheck, CircleAlert as AlertCircle, Globe, Key, Plug, Trash2, RefreshCw, Truck, Pencil, Plus, X, Bike, Store, MapPin, FileText, Image as ImageIcon, Database, Cloud, CloudOff, Zap, CloudDownload as DownloadCloud, CloudUpload as UploadCloud, Settings2, Box } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { useWoo } from '../auth/WooContext'
import {
  getCourierPartners, addCourierPartner, updateCourierPartner, deleteCourierPartner,
  type CourierPartner,
} from '@/lib/shipping'
import {
  getDeliveryStaff, addDeliveryStaff, updateDeliveryStaff, deleteDeliveryStaff,
  type DeliveryStaff, type DeliveryStaffStatus,
} from '@/lib/deliveryStaff'
import { getStoreProfile, saveStoreProfile, type StoreProfile } from '@/lib/storeProfile'
import { normalizeStoreUrl } from '@/lib/woocommerce'
import { fetchStaffUserByEmail, updateStaffUserInCloud } from '@/services/auth'
import {
  getSupabaseConfig, isSupabaseConfigured, initSupabase, clearSupabaseConfig,
  fullCloudSync, pullFromCloud,
} from '@/lib/supabase'

type Tab = 'profile' | 'woocommerce' | 'database' | 'shipping' | 'delivery'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 animate-fade-in">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Settings</h1>
          <p className="mt-1 text-slate-500">Manage your account, security, and integrations.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1">
          <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>
            <ShieldCheck className="h-4 w-4" /> Profile &amp; Security
          </TabButton>
          <TabButton active={tab === 'woocommerce'} onClick={() => setTab('woocommerce')}>
            <Plug className="h-4 w-4" /> WooCommerce
          </TabButton>
          <TabButton active={tab === 'database'} onClick={() => setTab('database')}>
            <Database className="h-4 w-4" /> Database &amp; Cloud
          </TabButton>
          <TabButton active={tab === 'shipping'} onClick={() => setTab('shipping')}>
            <Truck className="h-4 w-4" /> Shipping &amp; Couriers
          </TabButton>
          <TabButton active={tab === 'delivery'} onClick={() => setTab('delivery')}>
            <Bike className="h-4 w-4" /> Delivery Staff
          </TabButton>
        </div>

        {tab === 'profile' && <ProfileSecurityTab />}
        {tab === 'woocommerce' && <WooCommerceTab />}
        {tab === 'database' && <DatabaseCloudTab />}
        {tab === 'shipping' && <ShippingCouriersTab />}
        {tab === 'delivery' && <DeliveryStaffTab />}
      </div>
    </AppLayout>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

/* ---------------- Profile & Security ---------------- */

function ProfileSecurityTab() {
  const { user, refreshSession } = useAuth()
  const { appMode, setAppMode } = useWoo()

  // Operational mode
  const [modeSaving, setModeSaving] = useState(false)
  const [modeSaved, setModeSaved] = useState(false)

  const handleModeChange = (mode: 'standalone' | 'woo') => {
    if (mode === appMode || modeSaving) return
    setModeSaving(true)
    setAppMode(mode)
    localStorage.setItem('app_mode', mode === 'standalone' ? 'standalone' : 'woocommerce')
    window.setTimeout(() => {
      setModeSaving(false)
      setModeSaved(true)
      window.setTimeout(() => setModeSaved(false), 2500)
    }, 350)
  }

  // Business profile
  const [businessName, setBusinessName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  // Store profile
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(() => getStoreProfile())
  const [storeSaved, setStoreSaved] = useState(false)

  // Change email
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailStep, setEmailStep] = useState<'edit' | 'confirm'>('edit')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({})
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaved(true)
    window.setTimeout(() => setProfileSaved(false), 2500)
  }

  const handleStoreProfileSave = (e: React.FormEvent) => {
    e.preventDefault()
    saveStoreProfile(storeProfile)
    setStoreSaved(true)
    window.setTimeout(() => setStoreSaved(false), 2500)
  }

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) {
      setEmailError('Enter a new email address.')
      return
    }
    if (!EMAIL_RE.test(newEmail.trim())) {
      setEmailError('Enter a valid email address.')
      return
    }
    if (newEmail.trim() === user?.email) {
      setEmailError('This is already your current email.')
      return
    }
    setEmailError('')
    setEmailStep('confirm')
  }

  const handleEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setEmailSubmitting(true)
    try {
      await updateStaffUserInCloud(user.id, { email: newEmail.trim() })
      await refreshSession()
      setEmailSuccess(true)
      setNewEmail('')
      setEmailStep('edit')
      window.setTimeout(() => setEmailSuccess(false), 3000)
    } catch {
      setEmailError('Unable to update email. Please try again.')
    }
    setEmailSubmitting(false)
  }

  const handleEmailCancel = () => {
    setEmailStep('edit')
    setEmailError('')
    setNewEmail('')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const errors: typeof passwordErrors = {}
    if (!currentPassword) {
      errors.current = 'Enter your current password.'
    } else {
      const dbUser = await fetchStaffUserByEmail(user.email)
      if (!dbUser || dbUser.password !== currentPassword) errors.current = 'Current password is incorrect.'
    }
    if (!newPassword) errors.new = 'Enter a new password.'
    else if (newPassword.length < 8) errors.new = 'Password must be at least 8 characters.'
    if (!confirmPassword) errors.confirm = 'Confirm your new password.'
    else if (newPassword !== confirmPassword) errors.confirm = 'Passwords do not match.'
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return
    setPasswordSubmitting(true)
    try {
      await updateStaffUserInCloud(user.id, { password: newPassword })
      await refreshSession()
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => setPasswordSuccess(false), 3000)
    } catch {
      setPasswordErrors({ new: 'Unable to update password. Please try again.' })
    }
    setPasswordSubmitting(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Operational Mode Selection Card */}
      <Section
        icon={Settings2}
        title="Operational Mode"
        desc="Choose how Zubkas StorePulse runs: as a standalone cloud inventory/POS or linked to WooCommerce."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleModeChange('standalone')}
              className={`flex flex-col items-start rounded-2xl border-2 p-5 text-left transition ${
                appMode === 'standalone'
                  ? 'border-brand bg-brand-50/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  appMode === 'standalone' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Box className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Standalone Cloud POS</h3>
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Manual Inventory</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Direct Supabase database storage for products, offline billing, counter sales, and local inventory.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('woo')}
              className={`flex flex-col items-start rounded-2xl border-2 p-5 text-left transition ${
                appMode === 'woo'
                  ? 'border-brand bg-brand-50/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  appMode === 'woo' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Globe className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">WooCommerce Live Sync</h3>
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">WordPress Connected</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Real-time two-way synchronization of products, stock, online orders, and tracking with WordPress WooCommerce.
              </p>
            </button>
          </div>

          {modeSaved && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 animate-fade-in">
              <CheckCircle2 className="h-4 w-4" /> Operational mode updated!
            </div>
          )}
        </div>
      </Section>

      {/* Store Profile */}
      <Section
        icon={Store}
        title="Store Profile Details"
        desc="These details appear on your invoices, shipping labels, and customer communications."
      >
        <form onSubmit={handleStoreProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business / Store Name" htmlFor="store-business-name">
              <input
                id="store-business-name"
                value={storeProfile.businessName}
                onChange={(e) => setStoreProfile((p) => ({ ...p, businessName: e.target.value }))}
                className="input-field"
                placeholder="Zubkas"
              />
            </Field>
            <Field label="Support Phone Number" htmlFor="store-support-phone">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="store-support-phone"
                type="tel"
                value={storeProfile.supportPhone}
                onChange={(e) => setStoreProfile((p) => ({ ...p, supportPhone: e.target.value }))}
                className="input-field pl-10"
                placeholder="+91 9876543210"
              />
            </Field>
          </div>

          <Field label="Support Email" htmlFor="store-support-email">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="store-support-email"
              type="email"
              value={storeProfile.supportEmail}
              onChange={(e) => setStoreProfile((p) => ({ ...p, supportEmail: e.target.value }))}
              className="input-field pl-10"
              placeholder="support@zubkas.com"
            />
          </Field>

          <Field label="Full Store Address & PIN Code" htmlFor="store-address">
            <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <textarea
              id="store-address"
              value={storeProfile.storeAddress}
              onChange={(e) => setStoreProfile((p) => ({ ...p, storeAddress: e.target.value }))}
              rows={2}
              className="input-field resize-none pl-10"
              placeholder="78, Main Bazaar, Salem, Tamil Nadu - 636006"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GSTIN / Tax Number" htmlFor="store-gstin" hint="Optional">
              <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="store-gstin"
                value={storeProfile.gstin}
                onChange={(e) => setStoreProfile((p) => ({ ...p, gstin: e.target.value }))}
                className="input-field pl-10 font-mono text-sm"
                placeholder="33ABCDE1234F1Z5"
              />
            </Field>
            <Field label="Store Logo URL" htmlFor="store-logo-url" hint="Optional">
              <ImageIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="store-logo-url"
                type="url"
                value={storeProfile.logoUrl}
                onChange={(e) => setStoreProfile((p) => ({ ...p, logoUrl: e.target.value }))}
                className="input-field pl-10 text-sm"
                placeholder="/zubkas-logo.png"
              />
            </Field>
          </div>

          {/* Logo preview */}
          {storeProfile.logoUrl.trim() && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <img
                src={storeProfile.logoUrl}
                alt="Store logo"
                className="h-12 w-auto rounded-lg object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <p className="text-xs text-slate-400">Logo preview — shown on invoices and shipping labels.</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save Store Profile <ArrowRight className="h-4 w-4" />
            </button>
            {storeSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 animate-fade-in">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </Section>

      {/* Business Profile */}
      <Section
        icon={Building2}
        title="Business Profile"
        desc="Update your business name and contact phone number."
      >
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business Name" htmlFor="business-name">
              <input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-field"
                placeholder="Your business name"
              />
            </Field>
            <Field label="Phone Number" htmlFor="phone">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field pl-10"
                placeholder="+1 (555) 000-0000"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save changes <ArrowRight className="h-4 w-4" />
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 animate-fade-in">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </Section>

      {/* Change Email */}
      <Section
        icon={Mail}
        title="Change Email"
        desc="Update the email address associated with your admin account."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Mail className="h-4 w-4 text-slate-400" />
            <span>Current email:</span>
            <span className="font-semibold text-slate-900">{user?.email ?? '—'}</span>
          </div>

          {emailSuccess && (
            <SuccessBanner>Admin email updated successfully!</SuccessBanner>
          )}

          {emailStep === 'edit' ? (
            <form onSubmit={handleEmailContinue} className="space-y-4" noValidate>
              <Field label="New Email Address" htmlFor="new-email" error={emailError}>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input-field"
                  placeholder="new@company.com"
                />
              </Field>
              <button type="submit" className="btn-primary">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailConfirm} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" /> Confirm the change
                </p>
                <p className="mt-1">
                  Your email will be updated to <span className="font-semibold">{newEmail}</span>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={emailSubmitting} className="btn-primary">
                  {emailSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
                  ) : (
                    <>Confirm &amp; Update <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <button type="button" onClick={handleEmailCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </Section>

      {/* Change Password */}
      <Section
        icon={Lock}
        title="Change Password"
        desc="Choose a strong password with at least 8 characters."
      >
        {passwordSuccess && (
          <div className="mb-4">
            <SuccessBanner>Password updated successfully!</SuccessBanner>
          </div>
        )}
        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <PasswordField
            label="Current Password"
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((s) => !s)}
            error={passwordErrors.current}
            autoComplete="current-password"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PasswordField
              label="New Password"
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((s) => !s)}
              error={passwordErrors.new}
              autoComplete="new-password"
            />
            <Field label="Confirm New Password" htmlFor="confirm-password" error={passwordErrors.confirm}>
              <input
                id="confirm-password"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </Field>
          </div>
          <button type="submit" disabled={passwordSubmitting} className="btn-primary">
            {passwordSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
            ) : (
              <>Update Password <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      </Section>
    </div>
  )
}

/* ---------------- WooCommerce ---------------- */

function WooCommerceTab() {
  const { connection, connect, disconnect } = useWoo()
  const [storeUrl, setStoreUrl] = useState(connection?.storeUrl ?? '')
  const [consumerKey, setConsumerKey] = useState(connection?.consumerKey ?? '')
  const [consumerSecret, setConsumerSecret] = useState(connection?.consumerSecret ?? '')
  const [errors, setErrors] = useState<{ storeUrl?: string; key?: string; secret?: string }>({})
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')

  const validate = () => {
    const next: typeof errors = {}
    if (!storeUrl.trim()) {
      next.storeUrl = 'Enter your store URL.'
    } else {
      try {
        const u = new URL(storeUrl.trim())
        if (!['http:', 'https:'].includes(u.protocol)) next.storeUrl = 'URL must start with http:// or https://'
      } catch {
        next.storeUrl = 'Enter a valid URL (e.g. https://myclientstore.com).'
      }
    }
    if (!consumerKey.trim()) next.key = 'Enter the consumer key (starts with ck_).'
    else if (!consumerKey.trim().startsWith('ck_')) next.key = 'Consumer key should start with "ck_".'
    if (!consumerSecret.trim()) next.secret = 'Enter the consumer secret (starts with cs_).'
    else if (!consumerSecret.trim().startsWith('cs_')) next.secret = 'Consumer secret should start with "cs_".'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (testing) return
    setTestError('')
    if (!validate()) return
    setTesting(true)
    const result = await connect({
      storeUrl: normalizeStoreUrl(storeUrl),
      consumerKey: consumerKey.trim(),
      consumerSecret: consumerSecret.trim(),
      connectedAt: new Date().toISOString(),
    })
    setTesting(false)
    if (!result.ok) {
      setTestError(result.error ?? 'Connection failed. Check your credentials.')
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setStoreUrl('')
    setConsumerKey('')
    setConsumerSecret('')
    setErrors({})
    setTestError('')
  }

  return (
    <div className="grid grid-cols-1 gap-6 animate-fade-in lg:grid-cols-3">
      {/* Left: form + status */}
      <div className="space-y-6 lg:col-span-2">
        {/* Connection status */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${connection ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Connection Status</p>
              <div className="flex items-center gap-2">
                {connection ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </span>
                    <span className="font-semibold text-green-700">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="font-semibold text-slate-500">Not Connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {connection && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" /> Disconnect
            </button>
          )}
        </div>

        {connection && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand" />
              <h3 className="font-semibold text-slate-900">Connected Store</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Store URL</dt>
                <dd className="font-medium text-slate-900 break-all">{connection.storeUrl}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Consumer Key</dt>
                <dd className="font-mono text-xs text-slate-700">{connection.consumerKey.slice(0, 12)}••••</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Connected Since</dt>
                <dd className="font-medium text-slate-700">
                  {new Date(connection.connectedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Key entry form */}
        <form onSubmit={handleTestAndSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
          <div className="mb-5 flex items-center gap-2">
            <Key className="h-5 w-5 text-brand" />
            <h3 className="font-display text-lg font-bold text-slate-900">WooCommerce API Keys</h3>
          </div>

          <div className="space-y-4">
            <Field label="Store URL" htmlFor="store-url" error={errors.storeUrl}>
              <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="store-url"
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                className="input-field pl-10"
                placeholder="https://myclientstore.com"
              />
            </Field>

            <Field label="Consumer Key" htmlFor="consumer-key" error={errors.key}>
              <input
                id="consumer-key"
                type="text"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </Field>

            <Field label="Consumer Secret" htmlFor="consumer-secret" error={errors.secret}>
              <input
                id="consumer-secret"
                type="text"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </Field>
          </div>

          {testError && (
            <div className="mt-4">
              <ErrorBanner>{testError}</ErrorBanner>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button type="submit" disabled={testing} className="btn-primary">
              {testing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Testing connection…</>
              ) : connection ? (
                <><RefreshCw className="h-4 w-4" /> Test &amp; Update Keys</>
              ) : (
                <>Test Connection &amp; Save Keys <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Right: help card */}
      <div className="lg:col-span-1">
        <div className="sticky top-24 overflow-hidden rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-brand">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-slate-900">How to get your WooCommerce keys</h3>
          <ol className="mt-4 space-y-3">
            {[
              'Login to your WordPress Admin dashboard.',
              'Go to WooCommerce → Settings → Advanced → REST API.',
              'Click "Add Key" and set permissions to Read/Write.',
              'Copy & paste the Consumer Key and Consumer Secret into the fields on the left.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl bg-white/70 px-4 py-3 text-xs text-slate-500">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              Your keys are stored locally in this browser and never sent anywhere except your own store.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Shipping & Couriers ---------------- */

function ShippingCouriersTab() {
  const [partners, setPartners] = useState<CourierPartner[]>(() => getCourierPartners())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState('')
  const [error, setError] = useState('')

  const resetForm = () => {
    setName('')
    setTrackingUrlTemplate('')
    setError('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (partner: CourierPartner) => {
    setEditingId(partner.id)
    setName(partner.name)
    setTrackingUrlTemplate(partner.trackingUrlTemplate)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter the courier partner name.')
      return
    }
    if (editingId) {
      updateCourierPartner(editingId, name, trackingUrlTemplate)
    } else {
      addCourierPartner(name, trackingUrlTemplate)
    }
    setPartners(getCourierPartners())
    resetForm()
  }

  const handleDelete = (id: string) => {
    deleteCourierPartner(id)
    setPartners(getCourierPartners())
    if (editingId === id) resetForm()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        icon={Truck}
        title="Courier Partners"
        desc="Manage the courier partners available in the Ship Order modal. Tracking URL templates use {tracking_number} as a placeholder."
      >
        <div className="space-y-3">
          {partners.length > 0 ? (
            partners.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                      <Truck className="h-4 w-4" />
                    </span>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                  </div>
                  {p.trackingUrlTemplate ? (
                    <p className="mt-1.5 truncate pl-10 font-mono text-xs text-slate-400">
                      {p.trackingUrlTemplate}
                    </p>
                  ) : (
                    <p className="mt-1.5 pl-10 text-xs text-slate-400">No tracking URL template</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(p)}
                    aria-label="Edit courier"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    aria-label="Delete courier"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No courier partners yet. Add one below.
            </div>
          )}
        </div>

        {/* Add / Edit form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-brand/20 bg-brand-50/30 p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                {editingId ? 'Edit Courier Partner' : 'Add Courier Partner'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Cancel"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Field label="Partner Name" htmlFor="courier-name" error={error}>
              <input
                id="courier-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                className="input-field"
                placeholder="e.g. Shadowfax"
              />
            </Field>
            <Field label="Tracking URL Template" htmlFor="courier-url" hint="Use {tracking_number} as placeholder">
              <input
                id="courier-url"
                type="url"
                value={trackingUrlTemplate}
                onChange={(e) => setTrackingUrlTemplate(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder="https://track.example.com/{tracking_number}"
              />
            </Field>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">
                {editingId ? 'Save Changes' : 'Add Partner'} <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand"
          >
            <Plus className="h-4 w-4" /> Add Courier Partner
          </button>
        )}
      </Section>

      {/* Help card */}
      <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-brand" />
          <h3 className="font-display text-lg font-bold text-slate-900">How tracking URLs work</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          When you ship an order, the tracking URL is automatically generated from the partner's template
          by replacing <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">{'{tracking_number}'}</code> with
          the AWB number you enter. You can always edit the URL manually before saving.
        </p>
        <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-slate-500">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Courier partners are stored locally in this browser and used across the Ship Order modal.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- shared bits ---------------- */

function Section({ icon: Icon, title, desc, children }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function PasswordField({
  label, id, value, onChange, show, onToggle, error, autoComplete,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; error?: string; autoComplete: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field px-10"
        placeholder="••••••••"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </Field>
  )
}

function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-fade-in">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {children}
    </div>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  )
}

/* ---------------- Database & Cloud ---------------- */

function DatabaseCloudTab() {
  const initial = getSupabaseConfig()
  const [url, setUrl] = useState(initial.url)
  const [anonKey, setAnonKey] = useState(initial.anonKey)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [testSuccess, setTestSuccess] = useState(false)
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const configured = isSupabaseConfigured()

  const handleTestConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (testing) return
    setTestError('')
    setTestSuccess(false)
    setTesting(true)
    try {
      const result = await initSupabase(url, anonKey)
      if (result.ok) {
        setTestSuccess(true)
        window.setTimeout(() => setTestSuccess(false), 3000)
      } else {
        setTestError(result.error)
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Connection failed.')
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = () => {
    clearSupabaseConfig()
    setUrl('')
    setAnonKey('')
    setTestError('')
    setTestSuccess(false)
    setSyncMsg(null)
  }

  const handlePushSync = async () => {
    if (syncing) return
    setSyncing('push')
    setSyncMsg(null)
    try {
      const results = await fullCloudSync()
      if (results.profile && results.users) {
        setSyncMsg({ type: 'success', text: 'Store profile and users pushed to cloud successfully.' })
      } else {
        setSyncMsg({ type: 'error', text: 'Partial sync — some data failed to upload. Check your connection.' })
      }
    } catch (err) {
      setSyncMsg({ type: 'error', text: err instanceof Error ? err.message : 'Sync failed.' })
    } finally {
      setSyncing(null)
    }
  }

  const handlePullSync = async () => {
    if (syncing) return
    setSyncing('pull')
    setSyncMsg(null)
    try {
      await pullFromCloud()
      setSyncMsg({ type: 'success', text: 'Cloud data pulled into this browser successfully.' })
    } catch (err) {
      setSyncMsg({ type: 'error', text: err instanceof Error ? err.message : 'Pull failed.' })
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Connection status */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${configured ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
            {configured ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Cloud Sync Status</p>
            <div className="flex items-center gap-2">
              {configured ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                  </span>
                  <span className="font-semibold text-green-700">Connected</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="font-semibold text-slate-500">Not Connected</span>
                </>
              )}
            </div>
          </div>
        </div>
        {configured && (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" /> Disconnect
          </button>
        )}
      </div>

      {/* Credentials form */}
      <Section
        icon={Database}
        title="Supabase Cloud Database"
        desc="Connect your Supabase project to sync store profile and staff data across devices."
      >
        <form onSubmit={handleTestConnect} className="space-y-4" noValidate>
          <Field label="Project URL" htmlFor="sb-url" error={testError || undefined}>
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sb-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setTestError('') }}
              className="input-field pl-10"
              placeholder="https://xyzcompany.supabase.co"
            />
          </Field>

          <Field label="Anon Key" htmlFor="sb-anon">
            <Key className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="sb-anon"
              type="text"
              value={anonKey}
              onChange={(e) => { setAnonKey(e.target.value); setTestError('') }}
              className="input-field pl-10 font-mono text-sm"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
          </Field>

          {testSuccess && <SuccessBanner>Connected to Supabase successfully!</SuccessBanner>}
          {testError && <ErrorBanner>{testError}</ErrorBanner>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={testing} className="btn-primary">
              {testing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Testing…</>
              ) : configured ? (
                <><RefreshCw className="h-4 w-4" /> Test &amp; Update</>
              ) : (
                <>Test &amp; Connect Cloud <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </form>
      </Section>

      {/* Sync actions */}
      {configured && (
        <Section
          icon={Zap}
          title="Cloud Sync"
          desc="Push your local data to the cloud or pull the latest cloud data into this browser."
        >
          {syncMsg && (
            <div className="mb-4">
              {syncMsg.type === 'success' ? <SuccessBanner>{syncMsg.text}</SuccessBanner> : <ErrorBanner>{syncMsg.text}</ErrorBanner>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handlePushSync}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Push to Cloud
            </button>
            <button
              onClick={handlePullSync}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing === 'pull' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              Pull from Cloud
            </button>
          </div>
        </Section>
      )}

      {/* Help card */}
      <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-5 w-5 text-brand" />
          <h3 className="font-display text-lg font-bold text-slate-900">How cloud sync works</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          Connecting your Supabase project lets you sync your store profile and staff accounts across multiple
          devices and browsers. Push uploads your current local data to the cloud; Pull replaces local data with
          the latest cloud copy.
        </p>
        <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-slate-500">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Your Supabase URL and anon key are stored locally in this browser and only used to talk to your own project.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Delivery Staff ---------------- */

function DeliveryStaffTab() {
  const [staff, setStaff] = useState<DeliveryStaff[]>(() => getDeliveryStaff())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [status, setStatus] = useState<DeliveryStaffStatus>('Active')
  const [error, setError] = useState('')

  const resetForm = () => {
    setName('')
    setPhone('')
    setVehicle('')
    setStatus('Active')
    setError('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (s: DeliveryStaff) => {
    setEditingId(s.id)
    setName(s.name)
    setPhone(s.phone)
    setVehicle(s.vehicle)
    setStatus(s.status)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter the staff member name.')
      return
    }
    if (!phone.trim()) {
      setError('Enter the phone number.')
      return
    }
    if (editingId) {
      updateDeliveryStaff(editingId, { name: name.trim(), phone: phone.trim(), vehicle: vehicle.trim(), status })
    } else {
      addDeliveryStaff({ name: name.trim(), phone: phone.trim(), vehicle: vehicle.trim(), status })
    }
    setStaff(getDeliveryStaff())
    resetForm()
  }

  const handleDelete = (id: string) => {
    deleteDeliveryStaff(id)
    setStaff(getDeliveryStaff())
    if (editingId === id) resetForm()
  }

  const activeCount = staff.filter((s) => s.status === 'Active').length

  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        icon={Bike}
        title="Delivery Staff"
        desc="Manage your delivery riders and drivers. Active staff are available for order assignment."
      >
        {/* Summary */}
        <div className="mb-4 flex gap-3">
          <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-medium text-slate-400">Total Staff</p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900">{staff.length}</p>
          </div>
          <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-medium text-slate-400">Active</p>
            <p className="mt-1 font-display text-xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-medium text-slate-400">On Leave</p>
            <p className="mt-1 font-display text-xl font-bold text-amber-600">{staff.length - activeCount}</p>
          </div>
        </div>

        {/* Staff list */}
        <div className="space-y-3">
          {staff.length > 0 ? (
            staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                      <Bike className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.phone}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-10">
                    <span className="font-mono text-xs text-slate-500">{s.vehicle || 'No vehicle'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(s)}
                    aria-label="Edit staff"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    aria-label="Delete staff"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No delivery staff yet. Add your first rider below.
            </div>
          )}
        </div>

        {/* Add / Edit form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-brand/20 bg-brand-50/30 p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                {editingId ? 'Edit Delivery Staff' : 'Add Delivery Boy'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Cancel"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="ds-name" error={error}>
                <input
                  id="ds-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  className="input-field"
                  placeholder="e.g. Ramesh Kumar"
                />
              </Field>
              <Field label="Phone Number" htmlFor="ds-phone">
                <input
                  id="ds-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="9876543210"
                />
              </Field>
              <Field label="Vehicle / Bike No" htmlFor="ds-vehicle">
                <input
                  id="ds-vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="KA05 AB 1234"
                />
              </Field>
              <Field label="Status" htmlFor="ds-status">
                <select
                  id="ds-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DeliveryStaffStatus)}
                  className="input-field"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">
                {editingId ? 'Save Changes' : 'Add Staff'} <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand"
          >
            <Plus className="h-4 w-4" /> Add Delivery Boy
          </button>
        )}
      </Section>

      {/* Help card */}
      <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Bike className="h-5 w-5 text-brand" />
          <h3 className="font-display text-lg font-bold text-slate-900">How delivery assignment works</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          When you assign an active delivery staff member to an order from the Orders page, the order status
          changes to <span className="font-semibold">Out for Delivery</span> and the assignment is synced to
          WooCommerce order metadata. Staff can then view their assigned orders in the Delivery Hub and
          mark them as delivered with a customer signature.
        </p>
        <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-slate-500">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Delivery staff data is stored locally in this browser and used across the Orders and Delivery Hub pages.
          </p>
        </div>
      </div>
    </div>
  )
}