import { getSupabase } from '@/lib/supabase'
import type { Customer } from '@/data/mockData'
import type { WooConnection } from '@/lib/woocommerce'
import { fetchCustomers, createWooCustomer, updateWooCustomer, deleteWooCustomer } from '@/lib/woocommerce'

/* ---------------- row type ---------------- */

type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  location: string
  orders_count: number
  total_spent: number
  created_at: string
  updated_at: string
  woo_customer_id: number | null
}

function mapRow(r: CustomerRow): Customer {
  const loc = r.location || '—'
  return {
    id: r.id,
    name: r.name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    location: loc,
    address: loc,
    orders: r.orders_count ?? 0,
    spent: Number(r.total_spent) || 0,
    joined: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}

/* ---------------- Supabase CRUD ---------------- */

export async function fetchStandaloneCustomers(): Promise<Customer[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as CustomerRow[]).map(mapRow)
}

export type CustomerInput = {
  name: string
  email: string
  phone: string
  address: string
}

export async function createStandaloneCustomer(input: CustomerInput): Promise<Customer> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')

  const trimmedName = input.name.trim()
  if (!trimmedName) throw new Error('Customer name is required and cannot be empty.')

  const row = {
    name: trimmedName,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    location: input.address.trim() || '—',
  }
  const { data, error } = await sb.from('customers').insert(row).select('*').single()
  if (error) throw new Error(`Failed to create customer: ${error.message}`)
  if (!data) throw new Error('Failed to create customer: no data returned from database.')
  return mapRow(data as CustomerRow)
}

export async function updateStandaloneCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (!trimmed) throw new Error('Customer name cannot be empty.')
    patch.name = trimmed
  }
  if (input.email !== undefined) patch.email = input.email.trim() || null
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null
  if (input.address !== undefined) patch.location = input.address.trim() || '—'
  const { data, error } = await sb.from('customers').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(`Failed to update customer: ${error.message}`)
  if (!data) throw new Error('Failed to update customer: no data returned from database.')
  return mapRow(data as CustomerRow)
}

export async function deleteStandaloneCustomer(id: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Cloud database is not connected.')
  const { error } = await sb.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* ---------------- WooCommerce upsert into Supabase (two-way sync) ---------------- */

export async function upsertWooCustomersToSupabase(wooCustomers: Customer[]): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  for (const c of wooCustomers) {
    const wooId = Number(c.id)
    if (isNaN(wooId)) continue
    // Check if this woo customer already exists in Supabase
    const { data: existing } = await sb
      .from('customers')
      .select('id')
      .eq('woo_customer_id', wooId)
      .maybeSingle()
    if (existing) {
      await sb.from('customers').update({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        location: c.location,
        orders_count: c.orders,
        total_spent: c.spent,
      }).eq('id', (existing as { id: string }).id)
    } else {
      await sb.from('customers').insert({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        location: c.location,
        orders_count: c.orders,
        total_spent: c.spent,
        woo_customer_id: wooId,
      })
    }
  }
}

/* ---------------- mode-aware operations ---------------- */

export async function fetchCustomersModeAware(
  isStandalone: boolean,
  connection: WooConnection | null,
): Promise<Customer[]> {
  if (isStandalone || !connection) {
    return fetchStandaloneCustomers()
  }
  // WooCommerce mode: fetch from Woo, upsert to Supabase, then return Woo data
  const wooCustomers = await fetchCustomers(connection)
  // Background upsert — don't block the UI on sync errors
  upsertWooCustomersToSupabase(wooCustomers).catch(() => { /* non-fatal */ })
  return wooCustomers
}

export async function createCustomerModeAware(
  isStandalone: boolean,
  connection: WooConnection | null,
  input: CustomerInput,
): Promise<Customer> {
  if (isStandalone || !connection) {
    return createStandaloneCustomer(input)
  }
  // WooCommerce mode: create in Woo first, then upsert to Supabase
  const wooCustomer = await createWooCustomer(connection, input)
  const sb = getSupabase()
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('customers')
        .select('id')
        .eq('woo_customer_id', Number(wooCustomer.id))
        .maybeSingle()
      if (existing) {
        await sb.from('customers').update({
          name: wooCustomer.name,
          email: wooCustomer.email || null,
          phone: wooCustomer.phone || null,
          location: wooCustomer.location,
        }).eq('id', (existing as { id: string }).id)
      } else {
        await sb.from('customers').insert({
          name: wooCustomer.name,
          email: wooCustomer.email || null,
          phone: wooCustomer.phone || null,
          location: wooCustomer.location,
          woo_customer_id: Number(wooCustomer.id),
        })
      }
    } catch { /* non-fatal sync error */ }
  }
  return wooCustomer
}

export async function updateCustomerModeAware(
  isStandalone: boolean,
  connection: WooConnection | null,
  id: string,
  input: Partial<CustomerInput>,
): Promise<Customer> {
  if (isStandalone || !connection) {
    return updateStandaloneCustomer(id, input)
  }
  // WooCommerce mode: update in Woo, then sync to Supabase
  const wooCustomer = await updateWooCustomer(connection, id, input)
  const sb = getSupabase()
  if (sb) {
    try {
      await sb.from('customers').update({
        name: wooCustomer.name,
        email: wooCustomer.email || null,
        phone: wooCustomer.phone || null,
        location: wooCustomer.location,
      }).eq('woo_customer_id', Number(wooCustomer.id))
    } catch { /* non-fatal sync error */ }
  }
  return wooCustomer
}

export async function deleteCustomerModeAware(
  isStandalone: boolean,
  connection: WooConnection | null,
  id: string,
): Promise<void> {
  if (isStandalone || !connection) {
    return deleteStandaloneCustomer(id)
  }
  // WooCommerce mode: delete from Woo, then from Supabase
  await deleteWooCustomer(connection, id)
  const sb = getSupabase()
  if (sb) {
    try {
      const numericId = Number(id.replace(/[^0-9]/g, ''))
      await sb.from('customers').delete().eq('woo_customer_id', numericId)
    } catch { /* non-fatal sync error */ }
  }
}
