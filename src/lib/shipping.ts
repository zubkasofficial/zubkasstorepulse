import type { Order } from '@/data/mockData'
import { getSupabase } from '@/lib/supabase'

export type CourierPartner = {
  id: string
  name: string
  trackingUrlTemplate: string
}

export type ShippingInfo = {
  orderId: string
  courier: string
  awb: string
  trackingUrl: string
  estimatedDelivery: string
  shippedAt: string
}

const COURIERS_KEY = 'zubkas_courier_partners'
const SHIPPING_KEY = 'zubkas_shipping_info'

const DEFAULT_COURIERS: CourierPartner[] = [
  { id: 'delhivery', name: 'Delhivery', trackingUrlTemplate: 'https://www.delhivery.com/track/{tracking_number}' },
  { id: 'bluedart', name: 'Blue Dart', trackingUrlTemplate: 'https://www.bluedart.com/trackdart-result?trackno={tracking_number}' },
  { id: 'dtdc', name: 'DTDC', trackingUrlTemplate: 'https://www.dtdc.com/tracking.asp?trackno={tracking_number}' },
  { id: 'indiapost', name: 'India Post', trackingUrlTemplate: 'https://www.indiapost.gov.in/vas/Pages/IndiaPostHome.aspx' },
  { id: 'stcourier', name: 'ST Courier', trackingUrlTemplate: 'https://www.stcourier.com/track/{tracking_number}' },
  { id: 'porter', name: 'Porter', trackingUrlTemplate: 'https://porter.in/track/{tracking_number}' },
  { id: 'local', name: 'Local Delivery', trackingUrlTemplate: '' },
]

/* ---------------- localStorage helpers ---------------- */

function getLocalCouriers(): CourierPartner[] {
  try {
    const raw = localStorage.getItem(COURIERS_KEY)
    if (!raw) {
      localStorage.setItem(COURIERS_KEY, JSON.stringify(DEFAULT_COURIERS))
      return DEFAULT_COURIERS
    }
    return JSON.parse(raw) as CourierPartner[]
  } catch {
    return DEFAULT_COURIERS
  }
}

function saveLocalCouriers(partners: CourierPartner[]): void {
  try {
    localStorage.setItem(COURIERS_KEY, JSON.stringify(partners))
  } catch {
    /* ignore */
  }
}

/* ---------------- Supabase sync ---------------- */

export async function fetchCourierPartnersFromCloud(): Promise<CourierPartner[] | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('courier_partners').select('*').order('created_at', { ascending: true })
    if (error || !data) return null
    return (data as Array<{ id: string; name: string; tracking_url_template: string }>).map((r) => ({
      id: r.id,
      name: r.name,
      trackingUrlTemplate: r.tracking_url_template ?? '',
    }))
  } catch {
    return null
  }
}

export async function pushCourierPartnersToCloud(partners: CourierPartner[]): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  try {
    // Upsert each partner
    const rows = partners.map((p) => ({
      id: isUuid(p.id) ? p.id : undefined,
      name: p.name,
      tracking_url_template: p.trackingUrlTemplate,
    }))
    for (const row of rows) {
      if (row.id) {
        await sb.from('courier_partners').upsert(row, { onConflict: 'id' })
      } else {
        await sb.from('courier_partners').insert({ name: row.name, tracking_url_template: row.tracking_url_template })
      }
    }
  } catch {
    /* ignore */
  }
}

/* ---------------- public API ---------------- */

export async function getCourierPartnersAsync(): Promise<CourierPartner[]> {
  const cloud = await fetchCourierPartnersFromCloud()
  if (cloud && cloud.length > 0) {
    saveLocalCouriers(cloud)
    return cloud
  }
  return getLocalCouriers()
}

export function getCourierPartners(): CourierPartner[] {
  return getLocalCouriers()
}

export async function saveCourierPartnersAsync(partners: CourierPartner[]): Promise<void> {
  saveLocalCouriers(partners)
  await pushCourierPartnersToCloud(partners)
}

export function saveCourierPartners(partners: CourierPartner[]): void {
  saveLocalCouriers(partners)
  pushCourierPartnersToCloud(partners).catch(() => {})
}

export async function addCourierPartnerAsync(name: string, trackingUrlTemplate: string): Promise<CourierPartner> {
  const partners = getCourierPartners()
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36)
  const partner: CourierPartner = { id, name: name.trim(), trackingUrlTemplate: trackingUrlTemplate.trim() }
  const next = [...partners, partner]
  await saveCourierPartnersAsync(next)

  // If cloud assigned a different id, update local
  const cloud = await fetchCourierPartnersFromCloud()
  if (cloud) {
    const found = cloud.find((c) => c.name === partner.name)
    if (found) {
      const updated = getCourierPartners().map((p) => (p.id === id ? found : p))
      saveLocalCouriers(updated)
      return found
    }
  }
  return partner
}

export function addCourierPartner(name: string, trackingUrlTemplate: string): CourierPartner {
  const partners = getCourierPartners()
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36)
  const partner: CourierPartner = { id, name: name.trim(), trackingUrlTemplate: trackingUrlTemplate.trim() }
  saveCourierPartners([...partners, partner])
  return partner
}

export async function updateCourierPartnerAsync(id: string, name: string, trackingUrlTemplate: string): Promise<void> {
  const partners = getCourierPartners().map((p) =>
    p.id === id ? { ...p, name: name.trim(), trackingUrlTemplate: trackingUrlTemplate.trim() } : p,
  )
  await saveCourierPartnersAsync(partners)
}

export function updateCourierPartner(id: string, name: string, trackingUrlTemplate: string): void {
  const partners = getCourierPartners().map((p) =>
    p.id === id ? { ...p, name: name.trim(), trackingUrlTemplate: trackingUrlTemplate.trim() } : p,
  )
  saveCourierPartners(partners)
}

export async function deleteCourierPartnerAsync(id: string): Promise<void> {
  const partners = getCourierPartners().filter((p) => p.id !== id)
  await saveCourierPartnersAsync(partners)
  const sb = getSupabase()
  if (sb && isUuid(id)) {
    try { await sb.from('courier_partners').delete().eq('id', id) } catch { /* ignore */ }
  }
}

export function deleteCourierPartner(id: string): void {
  const partners = getCourierPartners().filter((p) => p.id !== id)
  saveCourierPartners(partners)
  const sb = getSupabase()
  if (sb && isUuid(id)) {
    sb.from('courier_partners').delete().eq('id', id).then(() => {}, () => {})
  }
}

/* ---------------- tracking helpers ---------------- */

export function resolveTrackingUrl(template: string, awb: string): string {
  if (!template.trim()) return ''
  if (template.includes('{tracking_number}')) {
    return template.replace(/\{tracking_number\}/g, encodeURIComponent(awb.trim()))
  }
  return template
}

export function getShippingInfo(orderId: string): ShippingInfo | null {
  try {
    const raw = localStorage.getItem(SHIPPING_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, ShippingInfo>
    return all[orderId] ?? null
  } catch {
    return null
  }
}

export function getAllShippingInfo(): Record<string, ShippingInfo> {
  try {
    const raw = localStorage.getItem(SHIPPING_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ShippingInfo>) : {}
  } catch {
    return {}
  }
}

export function saveShippingInfo(info: ShippingInfo): void {
  try {
    const raw = localStorage.getItem(SHIPPING_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, ShippingInfo>) : {}
    all[info.orderId] = info
    localStorage.setItem(SHIPPING_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function clearShippingInfo(orderId: string): void {
  try {
    const raw = localStorage.getItem(SHIPPING_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as Record<string, ShippingInfo>
    delete all[orderId]
    localStorage.setItem(SHIPPING_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function getTrackingUrlForShipment(info: ShippingInfo): string {
  if (info.trackingUrl) return info.trackingUrl
  const partners = getCourierPartners()
  const partner = partners.find((p) => p.name === info.courier)
  if (partner) return resolveTrackingUrl(partner.trackingUrlTemplate, info.awb)
  return `https://www.google.com/search?q=${encodeURIComponent(`${info.courier} tracking ${info.awb}`)}`
}

export function buildWhatsAppMessage(order: Order, info: ShippingInfo): string {
  const trackingUrl = getTrackingUrlForShipment(info)
  return `Hello ${order.customer}, your order ${order.id} from Zubkas has been shipped via ${info.courier}. Tracking Number: ${info.awb}. Track here: ${trackingUrl}. Thank you!`
}

export function buildWhatsAppUrl(order: Order, info: ShippingInfo): string {
  const message = buildWhatsAppMessage(order, info)
  const phone = order.phone.replace(/[^0-9]/g, '')
  const cc = phone.length === 10 ? '91' : ''
  return `https://wa.me/${cc}${phone}?text=${encodeURIComponent(message)}`
}

/* ---------------- utils ---------------- */

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}
