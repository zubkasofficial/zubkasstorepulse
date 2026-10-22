import { getConnection } from '@/lib/woocommerce'
import { getSupabase } from '@/lib/supabase'

export type AppMode = 'standalone' | 'woo'

const MODE_KEY = 'app_mode'

export function getAppMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw === 'standalone' || raw === 'woo') return raw
  } catch {
    /* ignore */
  }
  return getConnection() ? 'woo' : 'standalone'
}

export function setAppMode(mode: AppMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    window.dispatchEvent(new CustomEvent('appmode-change', { detail: mode }))
  } catch {
    /* ignore */
  }
}

export async function saveOperationalModeToCloud(mode: AppMode): Promise<void> {
  const sb = getSupabase()
  const { data: existing, error: selectError } = await sb
    .from('store_settings')
    .select('id')
    .maybeSingle()
  if (selectError) throw selectError
  if (existing?.id) {
    const { error: updateError } = await sb
      .from('store_settings')
      .update({ operational_mode: mode, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updateError) throw updateError
  } else {
    const { error: insertError } = await sb
      .from('store_settings')
      .insert([{ operational_mode: mode }])
    if (insertError) throw insertError
  }
}

export async function fetchOperationalModeFromCloud(): Promise<AppMode | null> {
  try {
    const sb = getSupabase()
    const { data, error } = await sb.from('store_settings').select('operational_mode').maybeSingle()
    if (error) {
      console.error('[store_settings] operational mode fetch error:', error.message, error.code)
      return null
    }
    if (!data) return null
    return data.operational_mode === 'woo' ? 'woo' : data.operational_mode === 'standalone' ? 'standalone' : null
  } catch (err) {
    console.error('[store_settings] fetchOperationalModeFromCloud exception:', err)
    return null
  }
}
