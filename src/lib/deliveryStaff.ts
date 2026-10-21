import { getSupabase } from '@/lib/supabase'

export type DeliveryStaffStatus = 'Active' | 'On Leave'

export type DeliveryStaff = {
  id: string
  name: string
  phone: string
  vehicle: string
  status: DeliveryStaffStatus
  createdAt: string
}

export type DeliveryAssignment = {
  orderId: string
  staffId: string
  staffName: string
  staffPhone: string
  vehicle: string
  assignedAt: string
}

export type DeliveryCompletion = {
  orderId: string
  signature: string
  completedAt: string
  staffId: string
}

const STAFF_KEY = 'delivery_staff'
const ASSIGNMENT_KEY = 'delivery_assignments'
const COMPLETION_KEY = 'delivery_completions'

const DEFAULT_STAFF: DeliveryStaff[] = [
  { id: 'rider-1', name: 'Ramesh Kumar', phone: '9876543210', vehicle: 'KA05 AB 1234', status: 'Active', createdAt: new Date().toISOString() },
  { id: 'rider-2', name: 'Suresh Patel', phone: '9876543211', vehicle: 'KA05 CD 5678', status: 'Active', createdAt: new Date().toISOString() },
  { id: 'rider-3', name: 'Mahesh Singh', phone: '9876543212', vehicle: 'KA05 EF 9012', status: 'On Leave', createdAt: new Date().toISOString() },
]

/* ---------------- localStorage helpers ---------------- */

function getLocalStaff(): DeliveryStaff[] {
  try {
    const raw = localStorage.getItem(STAFF_KEY)
    if (!raw) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(DEFAULT_STAFF))
      return DEFAULT_STAFF
    }
    return JSON.parse(raw) as DeliveryStaff[]
  } catch {
    return DEFAULT_STAFF
  }
}

function saveLocalStaff(staff: DeliveryStaff[]): void {
  try {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff))
  } catch {
    /* ignore */
  }
}

/* ---------------- Supabase sync ---------------- */

export async function fetchDeliveryStaffFromCloud(): Promise<DeliveryStaff[] | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('delivery_staff').select('*').order('created_at', { ascending: true })
    if (error || !data) return null
    return (data as Array<{ id: string; name: string; phone: string; vehicle: string; status: string; created_at: string }>).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? '',
      vehicle: r.vehicle ?? '',
      status: (r.status === 'On Leave' ? 'On Leave' : 'Active') as DeliveryStaffStatus,
      createdAt: r.created_at ?? new Date().toISOString(),
    }))
  } catch {
    return null
  }
}

export async function pushDeliveryStaffToCloud(staff: DeliveryStaff[]): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  try {
    for (const s of staff) {
      const row = {
        id: isUuid(s.id) ? s.id : undefined,
        name: s.name,
        phone: s.phone,
        vehicle: s.vehicle,
        status: s.status,
      }
      if (row.id) {
        await sb.from('delivery_staff').upsert(row, { onConflict: 'id' })
      } else {
        await sb.from('delivery_staff').insert({ name: row.name, phone: row.phone, vehicle: row.vehicle, status: row.status })
      }
    }
  } catch {
    /* ignore */
  }
}

/* ---------------- public API ---------------- */

export async function getDeliveryStaffAsync(): Promise<DeliveryStaff[]> {
  const cloud = await fetchDeliveryStaffFromCloud()
  if (cloud && cloud.length > 0) {
    saveLocalStaff(cloud)
    return cloud
  }
  return getLocalStaff()
}

export function getDeliveryStaff(): DeliveryStaff[] {
  return getLocalStaff()
}

export async function saveDeliveryStaffAsync(staff: DeliveryStaff[]): Promise<void> {
  saveLocalStaff(staff)
  await pushDeliveryStaffToCloud(staff)
}

export function saveDeliveryStaff(staff: DeliveryStaff[]): void {
  saveLocalStaff(staff)
  pushDeliveryStaffToCloud(staff).catch(() => {})
}

export async function addDeliveryStaffAsync(data: Omit<DeliveryStaff, 'id' | 'createdAt'>): Promise<DeliveryStaff> {
  const staff = getDeliveryStaff()
  const tempId = `rider-${Date.now().toString(36)}`
  const next: DeliveryStaff = { ...data, id: tempId, createdAt: new Date().toISOString() }
  saveLocalStaff([...staff, next])

  // Insert to cloud and get real id
  const sb = getSupabase()
  if (sb) {
    try {
      const { data: inserted } = await sb.from('delivery_staff')
        .insert({ name: data.name, phone: data.phone, vehicle: data.vehicle, status: data.status })
        .select('*').single()
      if (inserted) {
        const cloudId = (inserted as { id: string }).id
        // Replace temp id with cloud id in local storage
        const updated = getLocalStaff().map((s) => (s.id === tempId ? { ...s, id: cloudId } : s))
        saveLocalStaff(updated)
        return { ...next, id: cloudId }
      }
    } catch {
      /* keep local */
    }
  }
  pushDeliveryStaffToCloud([next]).catch(() => {})
  return next
}

export function addDeliveryStaff(data: Omit<DeliveryStaff, 'id' | 'createdAt'>): DeliveryStaff {
  const staff = getDeliveryStaff()
  const id = `rider-${Date.now().toString(36)}`
  const next: DeliveryStaff = { ...data, id, createdAt: new Date().toISOString() }
  saveDeliveryStaff([...staff, next])
  return next
}

export async function updateDeliveryStaffAsync(id: string, data: Omit<DeliveryStaff, 'id' | 'createdAt'>): Promise<void> {
  const staff = getDeliveryStaff().map((s) => (s.id === id ? { ...s, ...data } : s))
  await saveDeliveryStaffAsync(staff)
}

export function updateDeliveryStaff(id: string, data: Omit<DeliveryStaff, 'id' | 'createdAt'>): void {
  const staff = getDeliveryStaff().map((s) => (s.id === id ? { ...s, ...data } : s))
  saveDeliveryStaff(staff)
}

export async function deleteDeliveryStaffAsync(id: string): Promise<void> {
  saveDeliveryStaff(getDeliveryStaff().filter((s) => s.id !== id))
  const assignments = getAllAssignments()
  for (const orderId of Object.keys(assignments)) {
    if (assignments[orderId].staffId === id) {
      delete assignments[orderId]
    }
  }
  saveAllAssignments(assignments)
  const sb = getSupabase()
  if (sb && isUuid(id)) {
    try { await sb.from('delivery_staff').delete().eq('id', id) } catch { /* ignore */ }
  }
}

export function deleteDeliveryStaff(id: string): void {
  saveDeliveryStaff(getDeliveryStaff().filter((s) => s.id !== id))
  const assignments = getAllAssignments()
  for (const orderId of Object.keys(assignments)) {
    if (assignments[orderId].staffId === id) {
      delete assignments[orderId]
    }
  }
  saveAllAssignments(assignments)
  const sb = getSupabase()
  if (sb && isUuid(id)) {
    sb.from('delivery_staff').delete().eq('id', id).then(() => {}, () => {})
  }
}

export function getActiveStaff(): DeliveryStaff[] {
  return getDeliveryStaff().filter((s) => s.status === 'Active')
}

export async function getActiveStaffAsync(): Promise<DeliveryStaff[]> {
  const all = await getDeliveryStaffAsync()
  return all.filter((s) => s.status === 'Active')
}

/* ---------------- assignments (localStorage only) ---------------- */

export function getAllAssignments(): Record<string, DeliveryAssignment> {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DeliveryAssignment>) : {}
  } catch {
    return {}
  }
}

export function saveAllAssignments(all: Record<string, DeliveryAssignment>): void {
  try {
    localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function getAssignment(orderId: string): DeliveryAssignment | null {
  const all = getAllAssignments()
  return all[orderId] ?? null
}

export function assignDeliveryStaff(orderId: string, staff: DeliveryStaff): DeliveryAssignment {
  const all = getAllAssignments()
  const assignment: DeliveryAssignment = {
    orderId,
    staffId: staff.id,
    staffName: staff.name,
    staffPhone: staff.phone,
    vehicle: staff.vehicle,
    assignedAt: new Date().toISOString(),
  }
  all[orderId] = assignment
  saveAllAssignments(all)
  return assignment
}

export function unassignDelivery(orderId: string): void {
  const all = getAllAssignments()
  delete all[orderId]
  saveAllAssignments(all)
}

export function getStaffAssignments(staffId: string): DeliveryAssignment[] {
  return Object.values(getAllAssignments()).filter((a) => a.staffId === staffId)
}

export function saveCompletion(orderId: string, signature: string, staffId: string): DeliveryCompletion {
  const all = getAllCompletions()
  const completion: DeliveryCompletion = {
    orderId,
    signature,
    completedAt: new Date().toISOString(),
    staffId,
  }
  all[orderId] = completion
  try {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return completion
}

export function getAllCompletions(): Record<string, DeliveryCompletion> {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DeliveryCompletion>) : {}
  } catch {
    return {}
  }
}

export function getCompletion(orderId: string): DeliveryCompletion | null {
  return getAllCompletions()[orderId] ?? null
}

export function buildDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export function buildTelUrl(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`
}

/* ---------------- utils ---------------- */

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}
