import { useState, useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import { buildThermalReceiptHTML, printThermalReceipt, type ReceiptData, type RollSize } from '@/lib/thermalReceipt'

type ThermalReceiptModalProps = {
  open: boolean
  data: ReceiptData | null
  onClose: () => void
  defaultRoll?: RollSize
}

export default function ThermalReceiptModal({ open, data, onClose, defaultRoll = '80mm' }: ThermalReceiptModalProps) {
  const [roll, setRoll] = useState<RollSize>(defaultRoll)
  const previewRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (open && data) setRoll(defaultRoll)
  }, [open, data, defaultRoll])

  useEffect(() => {
    if (!open || !data) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, data, onClose])

  useEffect(() => {
    if (!open || !data) return
    const iframe = previewRef.current
    if (!iframe) return
    const html = buildThermalReceiptHTML(data, roll)
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [open, data, roll])

  if (!open || !data) return null

  const handlePrint = () => {
    printThermalReceipt(data, roll)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Thermal Slip</p>
            <h2 className="font-display text-lg font-bold text-slate-900">Print Thermal Receipt</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Roll size selector */}
        <div className="flex items-center justify-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="mr-1 text-xs font-medium text-slate-500">Roll Size:</span>
          <button
            onClick={() => setRoll('58mm')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              roll === '58mm'
                ? 'bg-[#9f0f0f] text-white shadow-sm'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            58mm (2 inch)
          </button>
          <button
            onClick={() => setRoll('80mm')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              roll === '80mm'
                ? 'bg-[#9f0f0f] text-white shadow-sm'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            80mm (3 inch)
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="flex justify-center bg-slate-100 p-5">
          <div
            className="overflow-hidden rounded-md bg-white shadow-sm"
            style={{ width: roll === '58mm' ? '220px' : '300px' }}
          >
            <iframe
              ref={previewRef}
              title="Thermal receipt preview"
              className="border-0"
              style={{
                width: roll === '58mm' ? '220px' : '300px',
                height: '440px',
                display: 'block',
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" /> Print Thermal Slip
          </button>
        </div>
      </div>
    </div>
  )
}
