import type { NavKey } from '@/lib/permissions'
import { getSupabase } from '@/lib/supabase'

export type Role = 'admin' | 'store_manager' | 'cashier' | 'delivery_driver'

export type AccountStatus = 'active' | 'inactive'

export type StaffUserRow = {
  id: string
  name: string
  email: string
  password: string
  role: Role
  phone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RegisteredUser = {
  id: string
  name: string
  email: string
  password: string
  role: Role
  phone: string
  status: AccountStatus
  createdAt: string
}

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  phone: string
}

const SESSION_KEY = 'zubkas_session'
const USERS_CACHE_KEY = 'store_users_cache'

/* ---------------- Role -> NavKey permissions ---------------- */

export const ROLE_PERMISSIONS: Record<Role, NavKey[]> = {
  admin: ['dashboard', 'pos', 'orders', 'products', 'customers', 'coupons', 'delivery', 'reports', 'staff-roles', 'settings'],
  store_manager: ['dashboard', 'pos', 'orders', 'products', 'customers', 'coupons', 'delivery', 'reports', 'settings'],
  cashier: ['pos', 'orders'],
  delivery_driver: ['delivery'],
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  cashier: 'Cashier',
  delivery_driver: 'Delivery Driver',
}

export function permissionsForRole(role: Role): NavKey[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/* ---------------- Staff users — Supabase single source ---------------- */

function mapRowToRegisteredUser(row: StaffUserRow): RegisteredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    phone: row.phone ?? '',
    status: row.is_active ? 'active' : 'inactive',
    createdAt: row.created_at,
  }
}

export async function fetchStaffUsersFromCloud(): Promise<RegisteredUser[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('staff_users').select('*').order('created_at', { ascending: true })
  if (error || !data) return []
  const users = (data as StaffUserRow[]).map(mapRowToRegisteredUser)
  cacheUsers(users)
  return users
}

export async function fetchStaffUserByEmail(email: string): Promise<RegisteredUser | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('staff_users')
    .select('*')
    .ilike('email', email.trim())
  console.log('Supabase Auth Query Response:', { data, error })
  if (error) return null
  if (!data || data.length === 0) return null
  return mapRowToRegisteredUser(data[0] as StaffUserRow)
}

export async function fetchStaffUserById(id: string): Promise<RegisteredUser | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('staff_users').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return mapRowToRegisteredUser(data as StaffUserRow)
}

export async function createStaffUserInCloud(data: {
  name: string
  email: string
  password: string
  role: Role
  phone: string
  isActive?: boolean
}): Promise<RegisteredUser | null> {
  const sb = getSupabase()
  if (!sb) return null
  const row = {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    role: data.role,
    phone: data.phone.trim(),
    is_active: data.isActive ?? true,
  }
  const { data: inserted, error } = await sb.from('staff_users').insert(row).select('*').single()
  if (error || !inserted) return null
  return mapRowToRegisteredUser(inserted as StaffUserRow)
}

export async function updateStaffUserInCloud(id: string, patch: Partial<{
  name: string
  email: string
  password: string
  role: Role
  phone: string
  is_active: boolean
}>): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const updateRow: Record<string, unknown> = {}
  if (patch.name !== undefined) updateRow.name = patch.name.trim()
  if (patch.email !== undefined) updateRow.email = patch.email.trim().toLowerCase()
  if (patch.password !== undefined) updateRow.password = patch.password
  if (patch.role !== undefined) updateRow.role = patch.role
  if (patch.phone !== undefined) updateRow.phone = patch.phone.trim()
  if (patch.is_active !== undefined) updateRow.is_active = patch.is_active
  const { error } = await sb.from('staff_users').update(updateRow).eq('id', id)
  return !error
}

export async function deleteStaffUserInCloud(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { error } = await sb.from('staff_users').delete().eq('id', id)
  return !error
}

/* ---------------- Local cache (non-authoritative, for offline reads) ---------------- */

function cacheUsers(users: RegisteredUser[]): void {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users))
  } catch { /* ignore */ }
}

export function getCachedUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RegisteredUser[]
  } catch {
    return []
  }
}

export function saveRegisteredUsers(users: RegisteredUser[]): void {
  cacheUsers(users)
}

/* ---------------- OTP helpers (Supabase-backed) ---------------- */

type OtpRow = {
  id: string
  email: string
  otp_code: string
  expires_at: string
  is_used: boolean
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function storeOtpInCloud(email: string, otp: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await sb.from('otp_verifications').insert({
    email: email.trim().toLowerCase(),
    otp_code: otp,
    expires_at: expiresAt,
    is_used: false,
  })
}

export async function verifyOtpInCloud(email: string, otp: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const normalized = email.trim().toLowerCase()
  const { data, error } = await sb
    .from('otp_verifications')
    .select('*')
    .eq('email', normalized)
    .eq('otp_code', otp)
    .eq('is_used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return false
  const row = data as OtpRow
  if (new Date(row.expires_at).getTime() < Date.now()) return false
  await sb.from('otp_verifications').update({ is_used: true }).eq('id', row.id)
  return true
}

export async function clearOtpInCloud(email: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  await sb.from('otp_verifications').delete().eq('email', email.trim().toLowerCase())
}

/* ---------------- Session management (localStorage) ---------------- */

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function startSession(user: RegisteredUser): SessionUser {
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
  return session
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
