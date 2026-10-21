import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { saveRegisteredUsers, fetchStaffUsersFromCloud, type RegisteredUser } from '@/services/auth'

const SUPABASE_URL = 'https://dmwudyzbllwxrpaoekdg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd3VkeXpibGx3eHJwYW9la2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTEwOTIsImV4cCI6MjEwMjg4NzA5Mn0.cTLkLqkhiNQ_YPyYBdw7BkOny7_7HcUN2VYPQJx5cT8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

const LS_URL_KEY = 'supabase_url'
const LS_ANON_KEY = 'supabase_anon_key'

let client: SupabaseClient = supabase

function readEnv(name: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env?.[name]
}

function getStoredUrl(): string {
  try {
    const ls = localStorage.getItem(LS_URL_KEY)
    if (ls) return ls
  } catch { /* ignore */ }
  const env = readEnv('SUPABASE_URL') ?? readEnv('VITE_SUPABASE_URL')
  return env || SUPABASE_URL
}

function getStoredAnonKey(): string {
  try {
    const ls = localStorage.getItem(LS_ANON_KEY)
    if (ls) return ls
  } catch { /* ignore */ }
  const env = readEnv('SUPABASE_ANON_KEY') ?? readEnv('VITE_SUPABASE_ANON_KEY')
  return env || SUPABASE_ANON_KEY
}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  return { url: getStoredUrl(), anonKey: getStoredAnonKey() }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig()
  return url.trim().length > 0 && anonKey.trim().length > 0
}

export function getSupabase(): SupabaseClient {
  if (client) return client
  const { url, anonKey } = getSupabaseConfig()
  client = createClient(url, anonKey, { auth: { persistSession: false } })
  return client
}

export type InitResult = { ok: true } | { ok: false; error: string }

export async function initSupabase(url: string, anonKey: string): Promise<InitResult> {
  const trimmedUrl = url.trim()
  const trimmedKey = anonKey.trim()
  if (!trimmedUrl || !trimmedKey) {
    return { ok: false, error: 'Enter both the Supabase Project URL and Anon Key.' }
  }
  if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
    return { ok: false, error: 'Project URL must start with https:// (e.g. https://xyzcompany.supabase.co).' }
  }

  const testClient = createClient(trimmedUrl, trimmedKey, { auth: { persistSession: false } })
  try {
    const { error } = await testClient.from('store_profile').select('id').limit(1)
    if (error) {
      return { ok: false, error: `Connection test failed: ${error.message}` }
    }
  } catch (err) {
    return { ok: false, error: `Unable to reach Supabase: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }

  try {
    localStorage.setItem(LS_URL_KEY, trimmedUrl)
    localStorage.setItem(LS_ANON_KEY, trimmedKey)
  } catch {
    /* ignore */
  }
  client = testClient
  return { ok: true }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(LS_URL_KEY)
    localStorage.removeItem(LS_ANON_KEY)
  } catch {
    /* ignore */
  }
  client = supabase
}

/* ---------------- Cloud sync helpers ---------------- */

export async function syncUsersToCloud(users: RegisteredUser[]): Promise<void> {
  const sb = getSupabase()
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role,
    phone: u.phone,
    status: u.status,
    created_at: u.createdAt,
  }))
  if (rows.length === 0) return
  await sb.from('staff_users').upsert(rows, { onConflict: 'id' })
}

export async function fetchUsersFromCloud(): Promise<RegisteredUser[] | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('staff_users').select('*')
  if (error || !data) return null
  return data.map((row: Record<string, string>) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role as RegisteredUser['role'],
    phone: row.phone,
    status: (row.status === 'active' ? 'active' : 'inactive') as RegisteredUser['status'],
    createdAt: row.created_at,
  }))
}

export async function fullCloudSync(): Promise<{ profile: boolean; users: boolean }> {
  const results = { profile: false, users: false }
  const sb = getSupabase()
  if (!sb) return results
  try {
    const { getStoreProfile, syncStoreProfileToCloud } = await import('@/lib/storeProfile')
    await syncStoreProfileToCloud(getStoreProfile())
    results.profile = true
  } catch {
    /* ignore */
  }
  try {
    const users = await fetchStaffUsersFromCloud()
    if (users.length > 0) saveRegisteredUsers(users)
    results.users = true
  } catch {
    /* ignore */
  }
  return results
}

export async function pullFromCloud(): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { fetchStoreProfileFromCloud, saveStoreProfile } = await import('@/lib/storeProfile')
  const profile = await fetchStoreProfileFromCloud()
  if (profile) {
    saveStoreProfile(profile)
  }
  const users = await fetchUsersFromCloud()
  if (users && users.length > 0) {
    saveRegisteredUsers(users)
  }
}
