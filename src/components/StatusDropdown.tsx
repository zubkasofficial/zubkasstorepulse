import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { STATUS_BADGE, type OrderStatus } from '@/data/mockData'

const ALL_STATUSES: OrderStatus[] = ['Processing', 'Completed', 'On Hold', 'Cancelled', 'Refunded', 'Shipped', 'Out for Delivery']

type StatusDropdownProps = {
  status: OrderStatus
  onChange: (next: OrderStatus) => void
  disabled?: boolean
}

export default function StatusDropdown({ status, onChange, disabled = false }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${STATUS_BADGE[status]} ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:ring-2 hover:ring-slate-200'
        }`}
      >
        {status}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                {s}
              </span>
              {s === status && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_DOT: Record<OrderStatus, string> = {
  Processing: 'bg-blue-500',
  Completed: 'bg-green-500',
  'On Hold': 'bg-amber-500',
  Cancelled: 'bg-red-500',
  Refunded: 'bg-slate-400',
  Shipped: 'bg-indigo-500',
  'Out for Delivery': 'bg-purple-500',
}
