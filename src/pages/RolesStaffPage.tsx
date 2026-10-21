import { useEffect, useState } from 'react'
import {
  ShieldCheck, Users, Plus, Pencil, Trash2, Check, X, Lock,
  Bike, Store, User as UserIcon, LayoutDashboard, Calculator,
  ShoppingCart, Package, Ticket, ChartBar as BarChart3, Settings as SettingsIcon, Mail, Phone,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import StaffMemberModal from '@/components/StaffMemberModal'
import { useAuth } from '@/auth/AuthContext'
import {
  getStaffMembers, addStaffMember, updateStaffMember, deleteStaffMember,
  fetchCustomRolesFromCloud, addCustomRoleAsync, updateCustomRoleAsync, deleteCustomRoleAsync,
  getRoleBadgeClass, type StaffMember, type CustomRole,
} from '@/lib/staffUsers'
import { ALL_PERMISSIONS, type NavKey, type PermissionDef } from '@/lib/permissions'
import { ROLE_LABELS } from '@/services/auth'

type Tab = 'staff' | 'roles'

export default function RolesStaffPage() {
  const [tab, setTab] = useState<Tab>('staff')

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 animate-fade-in">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Roles &amp; Staff</h1>
          <p className="mt-1 text-slate-500">Manage team members, custom roles, and permissions.</p>
        </div>

        <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1">
          <TabButton active={tab === 'staff'} onClick={() => setTab('staff')}>
            <Users className="h-4 w-4" /> Team Members
          </TabButton>
          <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
            <ShieldCheck className="h-4 w-4" /> Custom Roles
          </TabButton>
        </div>

        {tab === 'staff' && <StaffTab />}
        {tab === 'roles' && <RolesTab />}
      </div>
    </AppLayout>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

/* =================== STAFF TAB =================== */

const STATUS_BADGE: Record<string, string> = {
  'Active': 'bg-green-50 text-green-700',
  'Inactive': 'bg-slate-100 text-slate-500',
}

function roleIcon(roleName: string): React.ComponentType<{ className?: string }> {
  if (roleName === 'Admin') return ShieldCheck
  if (roleName === 'Store Manager') return Store
  if (roleName === 'Delivery Driver') return Bike
  return UserIcon
}

function StaffTab() {
  const { staffId } = useAuth()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)

  const refresh = async () => {
    setLoading(true)
    const members = await getStaffMembers()
    setStaff(members)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleAdd = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  const handleEdit = (member: StaffMember) => {
    setEditTarget(member)
    setModalOpen(true)
  }

  const handleSave = async (data: Omit<StaffMember, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      if (editTarget) {
        await updateStaffMember(editTarget.id, data)
      } else {
        await addStaffMember(data)
      }
      await refresh()
      return true
    } catch {
      return false
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteStaffMember(deleteTarget.id)
    setDeleteTarget(null)
    await refresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${staff.length} team member${staff.length !== 1 ? 's' : ''} total`}
        </p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Add Member
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {staff.map((member) => {
            const roleLabel = ROLE_LABELS[member.role] ?? member.role
            const Icon = roleIcon(roleLabel)
            return (
              <div key={member.id} className="flex items-center gap-4 p-4 transition hover:bg-slate-50/50">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getRoleBadgeClass(roleLabel)}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                    {member.id === staffId && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">You</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {member.email}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {member.phone}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(roleLabel)}`}>
                    {roleLabel}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[member.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {member.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleEdit(member)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete"
                    disabled={member.id === staffId}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
          {staff.length === 0 && !loading && (
            <div className="p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No team members yet. Click "Add Member" to get started.</p>
            </div>
          )}
          {loading && (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#9f0f0f]" />
              <p className="mt-3 text-sm text-slate-500">Loading team members…</p>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <StaffMemberModal
          open={modalOpen}
          mode={editTarget ? 'edit' : 'create'}
          member={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          title="Remove Staff Member"
          message={`Are you sure you want to remove ${deleteTarget.name}? This action cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

/* =================== ROLES TAB =================== */

const PERMISSION_ICONS: Record<NavKey, React.ComponentType<{ className?: string }>> = {
  'dashboard': LayoutDashboard,
  'pos': Calculator,
  'orders': ShoppingCart,
  'products': Package,
  'customers': Users,
  'coupons': Ticket,
  'delivery': Bike,
  'reports': BarChart3,
  'staff-roles': ShieldCheck,
  'settings': SettingsIcon,
}

function RolesTab() {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CustomRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null)

  const refresh = async () => {
    const data = await fetchCustomRolesFromCloud()
    setRoles(data)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleCreate = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  const handleEdit = (role: CustomRole) => {
    setEditTarget(role)
    setModalOpen(true)
  }

  const handleSave = async (name: string, description: string, permissions: NavKey[]) => {
    if (editTarget) {
      await updateCustomRoleAsync(editTarget.id, name, description, permissions)
    } else {
      await addCustomRoleAsync(name, description, permissions)
    }
    await refresh()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteCustomRoleAsync(deleteTarget.id)
    setDeleteTarget(null)
    await refresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {roles.length} role{roles.length !== 1 ? 's' : ''} · {roles.filter(r => !r.isBuiltin).length} custom
        </p>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Create Role
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${getRoleBadgeClass(role.name)}`}>
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{role.name}</p>
                    {role.isBuiltin && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        <Lock className="h-3 w-3" /> Built-in
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{role.description}</p>
                </div>
              </div>
              {!role.isBuiltin && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(role)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Edit role"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(role)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {role.permissions.map((perm) => {
                const Icon = PERMISSION_ICONS[perm] ?? UserIcon
                return (
                  <span
                    key={perm}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                  >
                    <Icon className="h-3 w-3" /> {perm}
                  </span>
                )
              })}
              {role.permissions.length === 0 && (
                <span className="text-xs text-slate-400">No permissions assigned</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <RoleModal
          open={modalOpen}
          mode={editTarget ? 'edit' : 'create'}
          role={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          title="Delete Custom Role"
          message={`Are you sure you want to delete the "${deleteTarget.name}" role? Staff members with this role will need to be reassigned.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

/* =================== ROLE MODAL =================== */

function RoleModal({
  open, mode, role, onClose, onSave,
}: {
  open: boolean
  mode: 'create' | 'edit'
  role: CustomRole | null
  onClose: () => void
  onSave: (name: string, description: string, permissions: NavKey[]) => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissions, setPermissions] = useState<NavKey[]>(role?.permissions ?? [])
  const [error, setError] = useState('')

  if (!open) return null

  const togglePerm = (key: NavKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a role name.')
      return
    }
    if (permissions.length === 0) {
      setError('Select at least one permission.')
      return
    }
    setError('')
    onSave(name.trim(), description.trim(), permissions)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-slide-in-right sm:max-w-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {mode === 'edit' ? 'Edit Role' : 'New Custom Role'}
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {mode === 'edit' ? 'Edit Role' : 'Create Custom Role'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Role Name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              className="input-field"
              placeholder="e.g. Inventory Manager"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="Brief description of this role"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Permissions</label>
            <div className="space-y-2">
              {ALL_PERMISSIONS.map((perm: PermissionDef) => {
                const Icon = PERMISSION_ICONS[perm.key] ?? UserIcon
                const checked = permissions.includes(perm.key)
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => togglePerm(perm.key)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      checked ? 'border-brand bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${checked ? 'text-brand' : 'text-slate-800'}`}>{perm.label}</p>
                      <p className="text-xs text-slate-400">{perm.description}</p>
                    </div>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-brand bg-brand' : 'border-slate-300'}`}>
                      {checked && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
          >
            <Check className="h-4 w-4" /> {mode === 'edit' ? 'Save Changes' : 'Create Role'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* =================== DELETE CONFIRM =================== */

function DeleteConfirm({
  title, message, onCancel, onConfirm,
}: {
  title: string
  message: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
