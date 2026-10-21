import { createContext, useContext, useState, type ReactNode } from 'react'
import type { NavKey } from '@/lib/permissions'
import { getPermissionsForRole, type StaffMember } from '@/lib/staffUsers'
import type { Role } from '@/services/auth'
import { ROLE_LABELS } from '@/services/auth'
import {
  getSession, startSession, clearSession,
  fetchStaffUserById, type SessionUser, type RegisteredUser,
} from '@/services/auth'

type AuthUser = SessionUser & {
  method: 'password' | 'otp' | 'pin'
  permissions: NavKey[]
}

type AuthContextValue = {
  user: AuthUser | null
  login: (user: RegisteredUser, method: 'password' | 'otp') => void
  loginAsStaff: (staff: StaffMember) => void
  switchProfile: (staff: StaffMember) => void
  logout: () => void
  refreshSession: () => Promise<void>
  permissions: NavKey[]
  role: string
  staffId: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function buildAuthUser(session: SessionUser, method: 'password' | 'otp' | 'pin'): AuthUser {
  const roleLabel = getRoleLabel(session.role)
  return {
    ...session,
    method,
    permissions: getPermissionsForRole(roleLabel),
  }
}

function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const session = getSession()
    if (!session) return null
    return buildAuthUser(session, 'password')
  })

  const login = (registeredUser: RegisteredUser, method: 'password' | 'otp') => {
    const session = startSession(registeredUser)
    setUser(buildAuthUser(session, method))
  }

  const loginAsStaff = (staff: StaffMember) => {
    const session = startSession(staff)
    setUser(buildAuthUser(session, 'pin'))
  }

  const switchProfile = (staff: StaffMember) => {
    const session = startSession(staff)
    setUser(buildAuthUser(session, 'pin'))
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  const refreshSession = async () => {
    if (!user) return
    const registered = await fetchStaffUserById(user.id)
    if (!registered) return
    const session = startSession(registered)
    setUser(buildAuthUser(session, user.method))
  }

  const permissions = user?.permissions ?? []
  const role = user ? getRoleLabel(user.role) : ''
  const staffId = user?.id ?? null

  return (
    <AuthContext.Provider value={{ user, login, loginAsStaff, switchProfile, logout, refreshSession, permissions, role, staffId }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
