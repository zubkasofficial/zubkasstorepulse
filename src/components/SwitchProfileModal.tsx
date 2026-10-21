import { useEffect, useState } from 'react'
import { X, Loader as Loader2, ShieldCheck, Store, Bike, User, ArrowRight, CircleAlert as AlertCircle } from 'lucide-react'
import { getStaffMembers, getRoleBadgeClass, type StaffMember } from '@/lib/staffUsers'
import { ROLE_LABELS } from '@/services/auth'

type SwitchProfileModalProps = {
  open: boolean
  currentStaffId: string | null
  onClose: () => void
  onSwitch: (staff: StaffMember, viaPin: boolean) => void
}

function roleIcon(roleKey: string): React.ComponentType<{ className?: string }> {
  if (roleKey === 'admin') return ShieldCheck
  if (roleKey === 'store_manager') return Store
  if (roleKey === 'delivery_driver') return Bike
  return User
}

function roleAccent(roleKey: string): string {
  if (roleKey === 'admin') return 'bg-[#9f0f0f] text-white'
  if (roleKey === 'store_manager') return 'bg-blue-50 text-blue-700'
  if (roleKey === 'delivery_driver') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

export default function SwitchProfileModal({ open, currentStaffId, onClose, onSwitch }: SwitchProfileModalProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [error, setError] = useState('')
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (open) {
      getStaffMembers().then(setStaff)
      setSelected(null)
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !switching) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, switching])

  if (!open) return null

  const handleSelect = (member: StaffMember) => {
    setSelected(member)
    setError('')
  }

  const handleConfirmSwitch = () => {
    if (!selected || switching) return
    if (selected.id === currentStaffId) {
      onClose()
      return
    }
    setSwitching(true)
    window.setTimeout(() => {
      setSwitching(false)
      onSwitch(selected, false)
    }, 500)
  }

  const handleClose = () => {
    if (switching) return
    setSelected(null)
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Quick Profile Switch</p>
            <h2 className="font-display text-xl font-bold text-slate-900">Switch Role</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!selected ? (
            <>
              <p className="text-sm text-slate-500">Choose a team member to switch to.</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {staff.map((member) => {
                  const Icon = roleIcon(member.role)
                  const isCurrent = member.id === currentStaffId
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleSelect(member)}
                      disabled={isCurrent}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        isCurrent
                          ? 'border-slate-100 bg-slate-50 cursor-default'
                          : 'border-slate-200 bg-white hover:border-brand/30 hover:bg-brand-50/30'
                      }`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${roleAccent(member.role)}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                        <p className="truncate text-xs text-slate-400">{member.email}</p>
                      </div>
                      {isCurrent ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Current</span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(ROLE_LABELS[member.role])}`}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${roleAccent(selected.role)}`}>
                  {(() => { const Icon = roleIcon(selected.role); return <Icon className="h-6 w-6" /> })()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{selected.name}</p>
                  <p className="truncate text-xs text-slate-400">{selected.email}</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(ROLE_LABELS[selected.role])}`}>
                    {ROLE_LABELS[selected.role]}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500">Click confirm to switch to this profile instantly.</p>

              {error && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleConfirmSwitch}
                  disabled={switching}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {switching ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Switching…</>
                  ) : (
                    <>Switch Profile <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setError('') }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
