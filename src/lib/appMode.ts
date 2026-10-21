import { getConnection } from '@/lib/woocommerce'

export type AppMode = 'standalone' | 'woo'

const MODE_KEY = 'app_mode'

export function getAppMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw === 'standalone' || raw === 'woo') return raw
  } catch {
    /* ignore */
  }
  // Default: standalone unless WooCommerce keys are already present
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
