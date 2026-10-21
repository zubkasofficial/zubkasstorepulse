import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  getStoreProfile, saveStoreProfile,
  type StoreProfile,
} from '@/lib/storeProfile'

const STORAGE_KEY = 'store_business_profile'

type StoreProfileContextValue = {
  profile: StoreProfile
  updateProfile: (next: StoreProfile) => void
}

const StoreProfileContext = createContext<StoreProfileContextValue | undefined>(undefined)

export function StoreProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StoreProfile>(() => getStoreProfile())

  const updateProfile = useCallback((next: StoreProfile) => {
    saveStoreProfile(next)
    setProfile(next)
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <StoreProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </StoreProfileContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStoreProfile(): StoreProfileContextValue {
  const ctx = useContext(StoreProfileContext)
  if (!ctx) throw new Error('useStoreProfile must be used within StoreProfileProvider')
  return ctx
}
