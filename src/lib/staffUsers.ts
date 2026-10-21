import type { NavKey } from '@/lib/permissions'
import type { Role, RegisteredUser, AccountStatus } from '@/services/auth'
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@/services/auth'
import {
  fetchStaffUsersFromCloud, createStaffUserInCloud, updateStaffUserInCloud,
  deleteStaffUserInCloud, getCachedUsers,
} from '@/services/auth'
import { getSupabase } from '@/lib/supabase'

export type { Role, RegisteredUser, AccountStatus }
export type StaffMember = RegisteredUser
export type StaffStatus = AccountStatus

/* ---------------- Built-in roles (for Custom Roles tab display) ---------------- */

export type CustomRole = {
  id: string
  name: string
  description: string
  permissions: NavKey[]
  isBuiltin: boolean
  createdAt: string
}

export const BUILTIN_ROLES: CustomRole[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full access to all features and settings',
    permissions: ROLE_PERMISSIONS.admin,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-manager',
    name: 'Store Manager',
    description: 'Dashboard, POS, orders, products, customers, coupons, and reports',
    permissions: ROLE_PERMISSIONS.store_manager,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-cashier',
    name: 'Cashier',
    description: 'POS Terminal and Orders only',
    permissions: ROLE_PERMISSIONS.cashier,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-delivery',
    name: 'Delivery Driver',
    description: 'Delivery Hub only',
    permissions: ROLE_PERMISSIONS.delivery_driver,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
]

/* ---------------- Staff CRUD (async, Supabase-backed) ---------------- */

export async function getStaffMembers(): Promise<StaffMember[]> {
  return fetchStaffUsersFromCloud()
}

export function getCachedStaffMembers(): StaffMember[] {
  return getCachedUsers()
}

export async function addStaffMember(data: Omit<StaffMember, 'id' | 'createdAt'>): Promise<StaffMember | null> {
  return createStaffUserInCloud({
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    phone: data.phone,
    isActive: data.status === 'active',
  })
}

export async function updateStaffMember(
  id: string,
  data: Partial<Omit<StaffMember, 'id' | 'createdAt'>>,
): Promise<boolean> {
  const patch: Parameters<typeof updateStaffUserInCloud>[1] = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.email !== undefined) patch.email = data.email
  if (data.password !== undefined) patch.password = data.password
  if (data.role !== undefined) patch.role = data.role
  if (data.phone !== undefined) patch.phone = data.phone
  if (data.status !== undefined) patch.is_active = data.status === 'active'
  return updateStaffUserInCloud(id, patch)
}

export async function deleteStaffMember(id: string): Promise<boolean> {
  return deleteStaffUserInCloud(id)
}

/* ---------------- Custom Roles CRUD (Supabase-backed) ---------------- */

type CustomRoleRow = {
  id: string
  name: string
  description: string
  permissions: string[]
  is_builtin: boolean
  created_at: string
}

function mapRoleRow(r: CustomRoleRow): CustomRole {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    permissions: Array.isArray(r.permissions) ? (r.permissions as NavKey[]) : [],
    isBuiltin: r.is_builtin,
    createdAt: r.created_at,
  }
}

export async function fetchCustomRolesFromCloud(): Promise<CustomRole[]> {
  const sb = getSupabase()
  if (!sb) return [...BUILTIN_ROLES]
  const { data, error } = await sb.from('custom_roles').select('*').order('created_at', { ascending: true })
  if (error || !data) return [...BUILTIN_ROLES]
  return (data as CustomRoleRow[]).map(mapRoleRow)
}

export async function addCustomRoleAsync(name: string, description: string, permissions: NavKey[]): Promise<CustomRole | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('custom_roles')
    .insert({
      name: name.trim(),
      description: description.trim(),
      permissions,
      is_builtin: false,
    })
    .select('*')
    .single()
  if (error || !data) return null
  return mapRoleRow(data as CustomRoleRow)
}

export async function updateCustomRoleAsync(id: string, name: string, description: string, permissions: NavKey[]): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { error } = await sb.from('custom_roles')
    .update({ name: name.trim(), description: description.trim(), permissions })
    .eq('id', id)
  return !error
}

export async function deleteCustomRoleAsync(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { error } = await sb.from('custom_roles').delete().eq('id', id)
  return !error
}

export async function getRoleByNameAsync(name: string): Promise<CustomRole | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('custom_roles').select('*').eq('name', name).maybeSingle()
  if (error || !data) return null
  return mapRoleRow(data as CustomRoleRow)
}

export async function getPermissionsForRoleAsync(roleName: string): Promise<NavKey[]> {
  const roleKey = (Object.keys(ROLE_LABELS) as Role[]).find((k) => ROLE_LABELS[k] === roleName)
  if (roleKey) return ROLE_PERMISSIONS[roleKey]
  const role = await getRoleByNameAsync(roleName)
  return role?.permissions ?? []
}

export async function getAllRoleNamesAsync(): Promise<string[]> {
  const roles = await fetchCustomRolesFromCloud()
  return roles.map((r) => r.name)
}

/* ---------------- Synchronous fallbacks (built-in only) ---------------- */

export function getAllRoles(): CustomRole[] {
  return [...BUILTIN_ROLES]
}

export function getPermissionsForRole(roleName: string): NavKey[] {
  const roleKey = (Object.keys(ROLE_LABELS) as Role[]).find((k) => ROLE_LABELS[k] === roleName)
  if (roleKey) return ROLE_PERMISSIONS[roleKey]
  return []
}

export function getAllRoleNames(): string[] {
  return BUILTIN_ROLES.map((r) => r.name)
}

/* ---------------- Role badge styling ---------------- */

export function getRoleBadgeClass(roleName: string): string {
  const builtin: Record<string, string> = {
    'Admin': 'bg-[#9f0f0f] text-white',
    'Store Manager': 'bg-blue-50 text-blue-700',
    'Cashier': 'bg-green-50 text-green-700',
    'Delivery Driver': 'bg-amber-50 text-amber-700',
  }
  if (builtin[roleName]) return builtin[roleName]
  return 'bg-slate-100 text-slate-700'
}
