import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  getConnection, saveConnection, clearConnection, testConnection,
  saveConnectionToCloud, fetchConnectionFromCloud, clearConnectionFromCloud,
  fetchOrders, fetchProducts, fetchCustomers, fetchSalesReport,
  type WooConnection, type Order, type Product, type Customer, type SalesReportData,
} from '@/lib/woocommerce'
import { playOrderChime, unlockAudio } from '@/lib/alertSound'
import { getAppMode, setAppMode as persistAppMode, type AppMode } from '@/lib/appMode'
import { fetchStandaloneProducts, fetchStandaloneOrders } from '@/lib/standaloneDb'

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
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
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
  }, [])

  const isStandalone = appMode === 'standalone'

  const refresh = useCallback(() => {
    if (isStandalone) {
      setLoading(true)
      Promise.all([fetchStandaloneProducts(), fetchStandaloneOrders()])
        .then(([p, o]) => {
          setProducts(p)
          setCustomers([])
          setSalesReport(null)
          setOrders((prev) => {
            const prevIds = new Set(prev.map((ord) => ord.id))
            const newOnes = o.filter((ord) => !prevIds.has(ord.id))
            if (newOnes.length > 0 && !firstLoadRef.current) {
              for (const n of newOnes) {
                setNewOrderAlerts((alerts) => [
                  ...alerts,
                  { id: n.id, total: n.total, customer: n.customer, timestamp: Date.now() },
                ])
              }
              if (soundAlertsOn) playOrderChime()
            }
            if (firstLoadRef.current) {
              knownOrderIdsRef.current = new Set(o.map((ord) => ord.id))
              firstLoadRef.current = false
            } else {
              for (const n of newOnes) knownOrderIdsRef.current.add(n.id)
            }
            return o
          })
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

        setOrders((prev) => {
          const prevIds = new Set(prev.map((ord) => ord.id))
          const newOnes = o.filter((ord) => !prevIds.has(ord.id))
          if (newOnes.length > 0 && !firstLoadRef.current) {
            for (const n of newOnes) {
              setNewOrderAlerts((alerts) => [
                ...alerts,
                { id: n.id, total: n.total, customer: n.customer, timestamp: Date.now() },
              ])
            }
            if (soundAlertsOn) playOrderChime()
          }
          // Track known IDs
          if (firstLoadRef.current) {
            knownOrderIdsRef.current = new Set(o.map((ord) => ord.id))
            firstLoadRef.current = false
          } else {
            for (const n of newOnes) knownOrderIdsRef.current.add(n.id)
          }
          return o
        })
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
    knownOrderIdsRef.current = new Set()
    firstLoadRef.current = true
    setNewOrderAlerts([])
    pushToast('success', 'Disconnected from store.')
  }, [pushToast])

  const setAppMode = useCallback((mode: AppMode) => {
    persistAppMode(mode)
    setAppModeState(mode)
    knownOrderIdsRef.current = new Set()
    firstLoadRef.current = true
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

  // Listen for mode changes dispatched from other tabs/components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AppMode>).detail
      if (detail === 'standalone' || detail === 'woo') {
        setAppModeState(detail)
        knownOrderIdsRef.current = new Set()
        firstLoadRef.current = true
      }
    }
    window.addEventListener('appmode-change', handler)
    return () => window.removeEventListener('appmode-change', handler)
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
        toasts,
        pushToast,
        dismissToast,
        soundAlertsOn,
        toggleSoundAlerts,
        newOrderAlerts,
        dismissNewOrderAlert,
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
