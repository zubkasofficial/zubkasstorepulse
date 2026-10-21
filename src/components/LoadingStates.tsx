import { RefreshCw, type LucideIcon } from 'lucide-react'

export function LoadingSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="mt-4 h-3 w-20 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-6 w-16 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  onRefresh,
}: {
  icon: LucideIcon
  title: string
  message: string
  onRefresh?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="mt-5 flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" /> Refresh Store Data
        </button>
      )}
    </div>
  )
}
