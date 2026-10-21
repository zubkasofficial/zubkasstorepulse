export type NavKey =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'products'
  | 'customers'
  | 'coupons'
  | 'delivery'
  | 'reports'
  | 'staff-roles'
  | 'settings'

export type PermissionDef = {
  key: NavKey
  label: string
  description: string
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Overview stats & KPI cards' },
  { key: 'pos', label: 'POS Terminal', description: 'Billing & cart checkout' },
  { key: 'orders', label: 'Orders', description: 'View, update status, print invoice/labels' },
  { key: 'products', label: 'Products', description: 'View, add, edit price/stock, delete' },
  { key: 'customers', label: 'Customers', description: 'View customers' },
  { key: 'coupons', label: 'Coupons', description: 'Manage coupons' },
  { key: 'delivery', label: 'Delivery Hub', description: 'View shipments, assign drivers, mark delivery status' },
  { key: 'reports', label: 'Reports & Analytics', description: 'View revenue charts, export GST/Excel' },
  { key: 'staff-roles', label: 'Roles & Staff', description: 'Manage custom roles, staff, and permissions' },
  { key: 'settings', label: 'Settings', description: 'Manage store settings and integrations' },
]

export const NAV_LABELS: Record<NavKey, string> = {
  dashboard: 'Dashboard',
  pos: 'POS Terminal',
  orders: 'Orders',
  products: 'Products',
  customers: 'Customers',
  coupons: 'Coupons',
  delivery: 'Delivery Hub',
  reports: 'Reports / Analytics',
  'staff-roles': 'Roles & Staff',
  settings: 'Settings',
}

export const ROUTE_BY_NAV: Record<NavKey, string> = {
  dashboard: '/dashboard',
  pos: '/pos',
  orders: '/orders',
  products: '/products',
  customers: '/customers',
  coupons: '/coupons',
  delivery: '/delivery',
  reports: '/reports',
  'staff-roles': '/staff-roles',
  settings: '/settings',
}

export function defaultRouteForPermissions(permissions: NavKey[]): string {
  if (permissions.length === 0) return '/login'
  if (permissions.includes('dashboard')) return '/dashboard'
  return ROUTE_BY_NAV[permissions[0]]
}

export function canAccessRoute(permissions: NavKey[], pathname: string): boolean {
  if (pathname === '/login') return true
  for (const key of permissions) {
    const route = ROUTE_BY_NAV[key]
    if (pathname === route || pathname.startsWith(route + '/')) return true
  }
  return false
}
