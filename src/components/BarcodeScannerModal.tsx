import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Camera, Keyboard, ScanLine, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react'
import { playBeep } from '@/lib/alertSound'

type BarcodeScannerModalProps = {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}

type DetectedBarcode = {
  rawValue: string
  format: string
}

const SUPPORTED_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e',
  'code_128', 'code_39', 'code_93',
  'qr_code', 'itf', 'codabar',
]

type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): {
    detect: (input: CanvasImageSource) => Promise<DetectedBarcode[]>
    getSupportedFormats?: () => Promise<string[]>
  }
}

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return w.BarcodeDetector ?? null
}

export default function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<{ detect: (input: CanvasImageSource) => Promise<DetectedBarcode[]> } | null>(null)
  const lastCodeRef = useRef<string>('')
  const lastTimeRef = useRef<number>(0)

  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'unsupported'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const triggerDetected = useCallback((code: string) => {
    const now = Date.now()
    if (code === lastCodeRef.current && now - lastTimeRef.current < 1500) return
    lastCodeRef.current = code
    lastTimeRef.current = now
    playBeep()
    setFlash(code)
    window.setTimeout(() => setFlash(null), 900)
    onDetected(code)
  }, [onDetected])

  const detectLoop = useCallback(async () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }
    try {
      const codes = await detector.detect(video)
      if (codes.length > 0 && codes[0].rawValue) {
        triggerDetected(codes[0].rawValue.trim())
      }
    } catch {
      // transient detect error — keep looping
    }
    rafRef.current = requestAnimationFrame(detectLoop)
  }, [triggerDetected])

  const startCamera = useCallback(async () => {
    setStatus('starting')
    setErrorMsg('')
    const BCD = getBarcodeDetector()
    if (!BCD) {
      setStatus('unsupported')
      setErrorMsg('Your browser does not support live camera barcode scanning. Use manual entry below.')
      return
    }
    try {
      detectorRef.current = new BCD({ formats: SUPPORTED_FORMATS })
    } catch {
      detectorRef.current = new BCD()
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play().catch(() => {})
        setStatus('scanning')
        rafRef.current = requestAnimationFrame(detectLoop)
      }
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Unable to access camera.'
      setErrorMsg(`${msg} Check camera permissions or use manual entry.`)
    }
  }, [detectLoop])

  useEffect(() => {
    if (!open) {
      stopStream()
      setStatus('idle')
      setErrorMsg('')
      setManualCode('')
      setFlash(null)
      lastCodeRef.current = ''
      return
    }
    // Try camera by default
    startCamera()
    return () => {
      stopStream()
    }
  }, [open, startCamera, stopStream])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    triggerDetected(code)
    setManualCode('')
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">POS Scanner</p>
              <h2 className="font-display text-lg font-bold text-slate-900">Scan Barcode</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-5 py-2">
          <button
            onClick={() => setMode('camera')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
              mode === 'camera' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </button>
          <button
            onClick={() => { setMode('manual'); stopStream(); setStatus('idle') }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
              mode === 'manual' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" /> Manual Entry
          </button>
        </div>

        {/* Camera view */}
        {mode === 'camera' && (
          <div className="p-5">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
              {status === 'scanning' ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  {/* Viewfinder overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative h-2/3 w-4/5 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                      <span className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-[#9f0f0f] rounded-tl-lg" />
                      <span className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-[#9f0f0f] rounded-tr-lg" />
                      <span className="absolute -left-1 -bottom-1 h-6 w-6 border-l-4 border-b-4 border-[#9f0f0f] rounded-bl-lg" />
                      <span className="absolute -right-1 -bottom-1 h-6 w-6 border-r-4 border-b-4 border-[#9f0f0f] rounded-br-lg" />
                      <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 bg-[#9f0f0f]/80 animate-pulse" />
                    </div>
                  </div>
                  {flash && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-500/20 animate-fade-in">
                      <CheckCircle2 className="h-12 w-12 text-white drop-shadow" />
                      <p className="rounded-lg bg-white/90 px-3 py-1 font-mono text-sm font-bold text-slate-900">
                        {flash}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  {status === 'starting' && <Loader2 className="h-8 w-8 animate-spin text-white" />}
                  {status === 'error' && <AlertCircle className="h-8 w-8 text-red-400" />}
                  {status === 'unsupported' && <AlertCircle className="h-8 w-8 text-amber-400" />}
                  {status === 'idle' && <Camera className="h-8 w-8 text-slate-400" />}
                  <p className="text-sm text-white/90">
                    {status === 'starting' && 'Starting camera…'}
                    {status === 'error' && (errorMsg || 'Camera error.')}
                    {status === 'unsupported' && (errorMsg || 'Camera scanning not supported.')}
                    {status === 'idle' && 'Camera stopped.'}
                  </p>
                  {status !== 'starting' && (
                    <button
                      onClick={startCamera}
                      className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#9f0f0f] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#880d0d]"
                    >
                      <Camera className="h-3.5 w-3.5" /> {status === 'idle' ? 'Start Camera' : 'Retry'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Point the camera at a product barcode. Detected items are added to the cart instantly.
            </p>
            {status === 'unsupported' && (
              <button
                onClick={() => setMode('manual')}
                className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Switch to Manual Entry
              </button>
            )}
          </div>
        )}

        {/* Manual entry */}
        {mode === 'manual' && (
          <div className="p-5">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Barcode / SKU</label>
                <input
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="input-field font-mono"
                  placeholder="Scan or type barcode…"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Add to Cart
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-slate-400">
              Type or paste a barcode/SKU and press Enter to add the matching product.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
