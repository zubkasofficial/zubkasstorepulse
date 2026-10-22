import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  getConnection, saveConnection, clearConnection, testConnection,
  saveConnectionToCloud, fetchConnectionFromCloud, clearConnectionFromCloud,
  fetchOrders, fetchProducts, fetchCustomers, fetchSalesReport,
  type WooConnection, type Order, type Product, type Customer, type SalesReportData,
} from '@/lib/woocommerce'
import { playOrderChime, unlockAudio } from '@/lib/alertSound'
import { getAppMode, setAppMode as persistAppMode, saveOperationalModeToCloud, fetchOperationalModeFromCloud, type AppMode } from '@/lib/appMode'
import { fetchStandaloneProducts, fetchStandaloneOrders } from '@/lib/standaloneDb'
import { fetchStandaloneCustomers } from '@/lib/customers'

const SEEN_ORDERS_KEY = 'zubkas_seen_order_ids'
const SEEN_MAX = 500

function loadSeenOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ORDERS_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

function persistSeenOrderIds(ids: Set<string>): void {
  try {
    const arr = Array.from(ids)
    const trimmed = arr.length > SEEN_MAX ? arr.slice(arr.length - SEEN_MAX) : arr
    localStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

type Toast = { id: number; type: 'success' | 'error'; message: string }

type NewOrderAlert = {
  id: string
  total: number
  customer: string
  timestamp: number
}

type WooContextValue = {
  connection: WooConnection | null
  isConnected: boolean
  isLive: boolean
  connecting: boolean
  connect: (data: WooConnection) => Promise<{ ok: boolean; error?: string }>
  disconnect: () => void
  // operational mode
  appMode: AppMode
  isStandalone: boolean
  setAppMode: (mode: AppMode) => void
  saveOperationalMode: (mode: AppMode) => Promise<void>
  // live data
  orders: Order[]
  products: Product[]
  customers: Customer[]
  salesReport: SalesReportData | null
  loading: boolean
  refresh: () => void
  // local mutations (optimistic)
  updateOrder: (id: string, patch: Partial<Order>) => void
  addProduct: (product: Product) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  removeProduct: (id: string) => void
  // customer mutations
  addCustomer: (customer: Customer) => void
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  removeCustomer: (id: string) => void
  setCustomers: (customers: Customer[]) => void
  // toasts
  toasts: Toast[]
  pushToast: (type: 'success' | 'error', message: string) => void
  dismissToast: (id: number) => void
  // sound alerts
  soundAlertsOn: boolean
  toggleSoundAlerts: () => void
  // new order alerts
  newOrderAlerts: NewOrderAlert[]
  dismissNewOrderAlert: (id: string) => void
  clearAllNewOrderAlerts: () => void
}

const POLL_INTERVAL = 30000

const WooContext = createContext<WooContextValue | undefined>(undefined)

export function WooProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<WooConnection | null>(() => getConnection())
  const [connecting, setConnecting] = useState(false)
  const [appMode, setAppModeState] = useState<AppMode>(() => getAppMode())
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [soundAlertsOn, setSoundAlertsOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zubkas_sound_alerts') !== 'off'
    } catch {
      return true
    }
  })
  const [newOrderAlerts, setNewOrderAlerts] = useState<NewOrderAlert[]>([])
  const seenOrderIdsRef = useRef<Set<string>>(loadSeenOrderIds())
  const firstLoadRef = useRef(true)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pushToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toggleSoundAlerts = useCallback(() => {
    setSoundAlertsOn((prev) => {
      const next = !prev
      try {
        localStorage.setItem('zubkas_sound_alerts', next ? 'on' : 'off')
      } catch { /* ignore */ }
      if (next) unlockAudio()
      return next
    })
  }, [])

  const dismissNewOrderAlert = useCallback((id: string) => {
    setNewOrderAlerts((prev) => prev.filter((a) => a.id !== id))
    seenOrderIdsRef.current.add(id)
    persistSeenOrderIds(seenOrderIdsRef.current)
  }, [])

  const clearAllNewOrderAlerts = useCallback(() => {
    setNewOrderAlerts([])
    for (const a of newOrderAlerts) seenOrderIdsRef.current.add(a.id)
    persistSeenOrderIds(seenOrderIdsRef.current)
  }, [newOrderAlerts])

  const isStandalone = appMode === 'standalone'

  const refresh = useCallback(() => {
    if (isStandalone) {
      setLoading(true)
      Promise.all([fetchStandaloneProducts(), fetchStandaloneOrders(), fetchStandaloneCustomers()])
        .then(([p, o, c]) => {
          setProducts(p)
          setCustomers(c)
          setSalesReport(null)
          setOrders(o)
          if (firstLoadRef.current) {
            for (const ord of o) seenOrderIdsRef.current.add(ord.id)
            persistSeenOrderIds(seenOrderIdsRef.current)
            firstLoadRef.current = false
          } else {
            const fresh = o.filter((ord) => !seenOrderIdsRef.current.has(ord.id))
            if (fresh.length > 0) {
              for (const n of fresh) {
                seenOrderIdsRef.current.add(n.id)
                setNewOrderAlerts((alerts) => [
                  ...alerts,
                  { id: n.id, total: n.total, customer: n.customer, timestamp: Date.now() },
                ])
              }
              persistSeenOrderIds(seenOrderIdsRef.current)
              if (soundAlertsOn) playOrderChime()
            }
          }
        })
        .catch((err) => {
          pushToast('error', `Failed to load cloud data: ${err instanceof Error ? err.message : 'Unknown error'}`)
        })
        .finally(() => setLoading(false))
      return
    }

    const conn = getConnection()
    if (!conn) {
      setOrders([])
      setProducts([])
      setCustomers([])
      setSalesReport(null)
      return
    }
    setLoading(true)
    Promise.all([fetchOrders(conn), fetchProducts(conn), fetchCustomers(conn), fetchSalesReport(conn)])
      .then(([o, p, c, s]) => {
        setProducts(p)
        setCustomers(c)
        setSalesReport(s)

        setOrders(o)
        if (firstLoadRef.current) {
          for (const ord of o) seenOrderIdsRef.current.add(ord.id)
          persistSeenOrderIds(seenOrderIdsRef.current)
          firstLoadRef.current = false
        } else {
          const fresh = o.filter((ord) => !seenOrderIdsRef.current.has(ord.id))
          if (fresh.length > 0) {
            for (const n of fresh) {
              seenOrderIdsRef.current.add(n.id)
              setNewOrderAlerts((alerts) => [
                ...alerts,
                { id: n.id, total: n.total, customer: n.customer, timestamp: Date.now() },
              ])
            }
            persistSeenOrderIds(seenOrderIdsRef.current)
            if (soundAlertsOn) playOrderChime()
          }
        }
      })
      .catch((err) => {
        pushToast('error', `Failed to sync live data: ${err instanceof Error ? err.message : 'Unknown error'}`)
      })
      .finally(() => setLoading(false))
  }, [pushToast, soundAlertsOn, isStandalone])

  const connect = useCallback(
    async (data: WooConnection): Promise<{ ok: boolean; error?: string }> => {
      setConnecting(true)
      const result = await testConnection(data)
      setConnecting(false)
      if (result.ok) {
        saveConnection(data)
        await saveConnectionToCloud(data)
        setConnection(data)
        pushToast('success', 'Connected successfully to WooCommerce Store!')
      }
      return result
    },
    [pushToast],
  )

  const disconnect = useCallback(() => {
    clearConnection()
    clearConnectionFromCloud()
    setConnection(null)
    setOrders([])
    setProducts([])
    setCustomers([])
    setSalesReport(null)
    firstLoadRef.current = true
    setNewOrderAlerts([])
    pushToast('success', 'Disconnected from store.')
  }, [pushToast])

  const setAppMode = useCallback((mode: AppMode) => {
    persistAppMode(mode)
    setAppModeState(mode)
    firstLoadRef.current = true
  }, [])

  const saveOperationalMode = useCallback(async (mode: AppMode) => {
    persistAppMode(mode)
    setAppModeState(mode)
    firstLoadRef.current = true
    await saveOperationalModeToCloud(mode)
  }, [])

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [product, ...prev])
  }, [])

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => [customer, ...prev])
  }, [])

  const updateCustomer = useCallback((id: string, patch: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const removeCustomer = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const setCustomersState = useCallback((cs: Customer[]) => {
    setCustomers(cs)
  }, [])

  // Listen for mode changes dispatched from other tabs/components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AppMode>).detail
      if (detail === 'standalone' || detail === 'woo') {
        setAppModeState(detail)
        firstLoadRef.current = true
      }
    }
    window.addEventListener('appmode-change', handler)
    return () => window.removeEventListener('appmode-change', handler)
  }, [])

  // On app startup: fetch operational mode from Supabase (fallback to localStorage)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cloudMode = await fetchOperationalModeFromCloud()
        if (cancelled) return
        if (cloudMode) {
          persistAppMode(cloudMode)
          setAppModeState(cloudMode)
        }
      } catch (err) {
        console.error('[WooContext] Failed to fetch operational mode from cloud:', err)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On app startup: fetch WooCommerce credentials from Supabase first,
  // falling back to local storage. This ensures all devices see the same connection.
  useEffect(() => {
    let cancelled = false
    if (isStandalone) return
    // If we already have a local connection, still check cloud for updates
    (async () => {
      try {
        const cloudConn = await fetchConnectionFromCloud()
        if (cancelled) return
        if (cloudConn) {
          saveConnection(cloudConn)
          setConnection(cloudConn)
        } else if (!getConnection()) {
          // No cloud creds and no local creds — nothing to do
          console.info('[WooContext] No cloud or local WooCommerce credentials found.')
        }
      } catch (err) {
        console.error('[WooContext] Failed to fetch credentials from store_settings:', err)
        // Fall back to whatever is in localStorage — don't block app rendering
        const localConn = getConnection()
        if (localConn) setConnection(localConn)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone])

  // Auto-load data when connection or mode appears
  useEffect(() => {
    if (isStandalone || connection) {
      refresh()
    }
  }, [connection, refresh, isStandalone, appMode])

  // Background polling for new orders
  useEffect(() => {
    if (!isStandalone && !connection) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    pollingRef.current = setInterval(() => {
      refresh()
    }, POLL_INTERVAL)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [connection, refresh, isStandalone])

  // Auto-dismiss new order alerts after 10s
  useEffect(() => {
    if (newOrderAlerts.length === 0) return
    const timers = newOrderAlerts.map((a) =>
      window.setTimeout(() => dismissNewOrderAlert(a.id), 10000),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [newOrderAlerts, dismissNewOrderAlert])

  return (
    <WooContext.Provider
      value={{
        connection,
        isConnected: !!connection,
        isLive: !!connection || isStandalone,
        connecting,
        connect,
        disconnect,
        appMode,
        isStandalone,
        setAppMode,
        saveOperationalMode,
        orders,
        products,
        customers,
        salesReport,
        loading,
        refresh,
        updateOrder,
        addProduct,
        updateProduct,
        removeProduct,
        addCustomer,
        updateCustomer,
        removeCustomer,
        setCustomers: setCustomersState,
        toasts,
        pushToast,
        dismissToast,
        soundAlertsOn,
        toggleSoundAlerts,
        newOrderAlerts,
        dismissNewOrderAlert,
        clearAllNewOrderAlerts,
      }}
    >
      {children}
    </WooContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWoo(): WooContextValue {
  const ctx = useContext(WooContext)
  if (!ctx) throw new Error('useWoo must be used within WooProvider')
  return ctx
}
