import { getSupabase } from '@/lib/supabase'

export type StoreProfile = {
  businessName: string
  supportPhone: string
  supportEmail: string
  storeAddress: string
  gstin: string
  logoUrl: string
  appMode?: string
}

const STORAGE_KEY = 'store_business_profile'

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  businessName: 'Zubkas',
  supportPhone: '+91 9876543210',
  supportEmail: 'support@zubkas.com',
  storeAddress: '78, Main Bazaar, Salem, Tamil Nadu - 636006',
  gstin: '',
  logoUrl: '/zubkas-logo.png',
  appMode: 'standalone',
}

export function getStoreProfile(): StoreProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STORE_PROFILE
    const parsed = JSON.parse(raw) as Partial<StoreProfile>
    return { ...DEFAULT_STORE_PROFILE, ...parsed }
  } catch {
    return DEFAULT_STORE_PROFILE
  }
}

export function saveStoreProfile(profile: StoreProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    /* ignore */
  }
  // Best-effort cloud sync
  syncStoreProfileToCloud(profile).catch(() => {})
}

/* ---------------- Supabase sync ---------------- */

export async function syncStoreProfileToCloud(profile: StoreProfile): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  await sb.from('store_profile').upsert({
    id: 1,
    business_name: profile.businessName,
    support_phone: profile.supportPhone,
    support_email: profile.supportEmail,
    store_address: profile.storeAddress,
    gstin: profile.gstin,
    logo_url: profile.logoUrl,
    app_mode: profile.appMode ?? 'standalone',
  }, { onConflict: 'id' })
}

export async function fetchStoreProfileFromCloud(): Promise<StoreProfile | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('store_profile').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return {
    businessName: data.business_name ?? DEFAULT_STORE_PROFILE.businessName,
    supportPhone: data.support_phone ?? DEFAULT_STORE_PROFILE.supportPhone,
    supportEmail: data.support_email ?? DEFAULT_STORE_PROFILE.supportEmail,
    storeAddress: data.store_address ?? DEFAULT_STORE_PROFILE.storeAddress,
    gstin: data.gstin ?? '',
    logoUrl: data.logo_url ?? DEFAULT_STORE_PROFILE.logoUrl,
    appMode: data.app_mode ?? 'standalone',
  }
}

export async function pullStoreProfileFromCloud(): Promise<void> {
  const cloud = await fetchStoreProfileFromCloud()
  if (cloud) {
    saveStoreProfile(cloud)
  }
}
