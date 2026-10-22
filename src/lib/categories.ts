import { getSupabase } from '@/lib/supabase'
import type { WooConnection } from '@/lib/woocommerce'
import type { AppMode } from '@/lib/appMode'

export type Category = {
  id: string
  name: string
  slug: string
  createdAt: string
}

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

/* ---------------- mode-aware fetching ---------------- */

export async function fetchCategoriesFromCloud(): Promise<Category[]> {
  const sb = getSupabase()
  if (!sb) return getCached()
  try {
    const { data, error } = await sb.from('categories').select('*').order('name', { ascending: true })
    if (error || !data) {
      return getCached()
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
    return getCached()
  }
}

type WooCategoryRaw = {
  id: number
  name: string
  slug: string
  count?: number
}

export async function fetchCategoriesFromWooCommerce(conn: WooConnection): Promise<Category[]> {
  const base = conn.storeUrl.replace(/\/+$/, '')
  const auth = btoa(`${conn.consumerKey}:${conn.consumerSecret}`)
  const directUrl = `${base}/wp-json/wc/v3/products/categories?per_page=100&orderby=name&order=asc`

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  }

  const proxies = [
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]

  let data: WooCategoryRaw[] | null = null

  try {
    const res = await fetch(directUrl, { method: 'GET', headers })
    if (res.ok) {
      data = (await res.json()) as WooCategoryRaw[]
    }
  } catch {
    /* fall through to proxy */
  }

  if (!data) {
    const proxyUrl = `${directUrl}&consumer_key=${encodeURIComponent(conn.consumerKey)}&consumer_secret=${encodeURIComponent(conn.consumerSecret)}`
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy(proxyUrl), { method: 'GET', headers })
        if (res.ok) {
          data = (await res.json()) as WooCategoryRaw[]
          break
        }
      } catch {
        /* try next */
      }
    }
  }

  if (!data) return getCached()

  const mapped: Category[] = data.map((c) => ({
    id: `woo-${c.id}`,
    name: c.name,
    slug: c.slug,
    createdAt: new Date().toISOString(),
  }))
  return mapped
}

export async function fetchCategories(mode: AppMode, connection: WooConnection | null): Promise<Category[]> {
  if (mode === 'woo' && connection) {
    try {
      return await fetchCategoriesFromWooCommerce(connection)
    } catch {
      return fetchCategoriesFromCloud()
    }
  }
  return fetchCategoriesFromCloud()
}

/* ---------------- typed create result ---------------- */

export type CreateCategoryResult =
  | { ok: true; category: Category }
  | { ok: false; error: string; code?: string }

export async function createCategoryInCloud(name: string): Promise<CreateCategoryResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Cloud database is not connected.' }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Category name cannot be empty.' }

  const slug = slugify(trimmed)

  // Check for existing slug or name in the database before inserting
  try {
    const { data: existing, error: checkError } = await sb
      .from('categories')
      .select('id, name, slug')
      .or(`slug.eq.${slug},name.eq.${trimmed}`)
      .maybeSingle()

    if (checkError) {
      return { ok: false, error: `Failed to check existing categories: ${checkError.message}`, code: checkError.code }
    }

    if (existing) {
      const existingRow = existing as { id: string; name: string; slug: string }
      if (existingRow.slug === slug) {
        return { ok: false, error: `A category with slug "${slug}" already exists.`, code: '23505' }
      }
      return { ok: false, error: `A category named "${existingRow.name}" already exists.`, code: '23505' }
    }
  } catch (err) {
    return { ok: false, error: `Failed to check existing categories: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }

  // Insert the new category
  try {
    const { data, error } = await sb
      .from('categories')
      .insert({ name: trimmed, slug })
      .select('*')
      .single()

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        return { ok: false, error: `This category name or slug already exists.`, code: '23505' }
      }
      return { ok: false, error: error.message, code: error.code }
    }

    if (!data) {
      return { ok: false, error: 'No data returned from database after insert.' }
    }

    const created: Category = {
      id: (data as { id: string }).id,
      name: (data as { name: string }).name,
      slug: (data as { slug: string }).slug,
      createdAt: (data as { created_at: string }).created_at ?? new Date().toISOString(),
    }
    const updated = [...getCached(), created]
    setCached(updated)
    return { ok: true, category: created }
  } catch (err) {
    return { ok: false, error: `Failed to create category: ${err instanceof Error ? err.message : 'Unknown error'}` }
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
