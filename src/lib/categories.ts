import { getSupabase } from '@/lib/supabase'
import type { WooConnection } from '@/lib/woocommerce'

export type Category = {
  id: string
  name: string
  slug: string
  createdAt: string
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', createdAt: new Date().toISOString() },
  { id: 'cat-wearables', name: 'Wearables', slug: 'wearables', createdAt: new Date().toISOString() },
  { id: 'cat-home-living', name: 'Home & Living', slug: 'home-living', createdAt: new Date().toISOString() },
  { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', createdAt: new Date().toISOString() },
]

const CACHE_KEY = 'zubkas_categories_cache'

function getCached(): Category[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Category[]
  } catch {
    return []
  }
}

function setCached(cats: Category[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cats))
  } catch {
    /* ignore */
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function fetchCategoriesFromCloud(): Promise<Category[]> {
  const sb = getSupabase()
  if (!sb) return getCached().length > 0 ? getCached() : FALLBACK_CATEGORIES
  try {
    const { data, error } = await sb.from('categories').select('*').order('name', { ascending: true })
    if (error || !data) {
      return getCached().length > 0 ? getCached() : FALLBACK_CATEGORIES
    }
    const mapped: Category[] = (data as Array<{ id: string; name: string; slug: string; created_at: string }>).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.created_at ?? new Date().toISOString(),
    }))
    setCached(mapped)
    return mapped
  } catch {
    return getCached().length > 0 ? getCached() : FALLBACK_CATEGORIES
  }
}

export async function createCategoryInCloud(name: string): Promise<Category | null> {
  const sb = getSupabase()
  if (!sb) return null
  const slug = slugify(name)
  try {
    const { data, error } = await sb
      .from('categories')
      .insert({ name, slug })
      .select('*')
      .single()
    if (error || !data) return null
    const created: Category = {
      id: (data as { id: string }).id,
      name: (data as { name: string }).name,
      slug: (data as { slug: string }).slug,
      createdAt: (data as { created_at: string }).created_at ?? new Date().toISOString(),
    }
    const updated = [...getCached(), created]
    setCached(updated)
    return created
  } catch {
    return null
  }
}

export async function deleteCategoryFromCloud(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  if (!isUuid(id)) return false
  try {
    const { error } = await sb.from('categories').delete().eq('id', id)
    if (error) return false
    setCached(getCached().filter((c) => c.id !== id))
    return true
  } catch {
    return false
  }
}

type WooCategoryResponse = {
  id: number
  name: string
  slug: string
}

export async function syncCategoryToWooCommerce(
  conn: WooConnection,
  name: string,
  slug: string,
): Promise<WooCategoryResponse | null> {
  const base = conn.storeUrl.replace(/\/+$/, '')
  const auth = btoa(`${conn.consumerKey}:${conn.consumerSecret}`)
  const directUrl = `${base}/wp-json/wc/v3/products/categories`
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  }
  const body = JSON.stringify({ name, slug })

  const proxies = [
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]

  try {
    const res = await fetch(directUrl, { method: 'POST', headers, body })
    if (res.ok) return (await res.json()) as WooCategoryResponse
    throw new Error(`Direct failed: ${res.status}`)
  } catch {
    const proxyUrl = `${directUrl}?consumer_key=${encodeURIComponent(conn.consumerKey)}&consumer_secret=${encodeURIComponent(conn.consumerSecret)}`
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy(proxyUrl), { method: 'POST', headers, body })
        if (res.ok) return (await res.json()) as WooCategoryResponse
      } catch {
        /* try next */
      }
    }
    return null
  }
}
