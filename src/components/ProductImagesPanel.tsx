import { useState, type DragEvent, type ReactNode } from 'react'
import { X, Loader as Loader2, ImagePlus } from 'lucide-react'
import { uploadProductImage, type ImageUploadTarget } from '@/lib/productImages'
import type { WooConnection } from '@/lib/woocommerce'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')

type ProductImagesPanelProps = {
  imageUrl: string
  galleryImages: string[]
  disabled: boolean
  appMode: 'standalone' | 'woo'
  connection: WooConnection | null
  onImageChange: (url: string) => void
  onGalleryChange: (urls: string[]) => void
  onBusyChange: (busy: boolean) => void
  onError: (message: string) => void
}

type UploadTarget = 'main' | 'gallery'

export default function ProductImagesPanel({
  imageUrl,
  galleryImages,
  disabled,
  appMode,
  connection,
  onImageChange,
  onGalleryChange,
  onBusyChange,
  onError,
}: ProductImagesPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [dragTarget, setDragTarget] = useState<UploadTarget | null>(null)
  const uploadTarget: ImageUploadTarget = appMode === 'standalone' ? { mode: 'standalone' } : { mode: 'woo', connection }

  const uploadFiles = async (files: File[], target: UploadTarget) => {
    const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
    if (images.length === 0) {
      onError('Choose a PNG, JPG, or WEBP image.')
      return
    }
    const selected = target === 'main' ? images.slice(0, 1) : images
    setUploading(true)
    onBusyChange(true)
    onError('')
    try {
      const urls: string[] = []
      for (const file of selected) {
        const { url } = await uploadProductImage(file, uploadTarget)
        urls.push(url)
      }
      if (target === 'main') onImageChange(urls[0])
      else onGalleryChange([...galleryImages, ...urls])
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to upload image.')
    } finally {
      setUploading(false)
      onBusyChange(false)
    }
  }

  const handleDrop = (target: UploadTarget) => (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragTarget(null)
    if (disabled || uploading) return
    void uploadFiles(Array.from(e.dataTransfer.files), target)
  }

  const handleDragOver = (target: UploadTarget) => (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    if (!disabled && !uploading) setDragTarget(target)
  }

  const handleInput = (target: UploadTarget) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    void uploadFiles(files, target)
  }

  const blocked = disabled || uploading

  return (
    <aside className="space-y-6">
      <PanelCard title="Product image">
        {imageUrl ? (
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={imageUrl} alt="Product" className="h-full w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                Replace image
                <input type="file" accept={ACCEPT_ATTR} className="sr-only" disabled={blocked} onChange={handleInput('main')} />
              </label>
              <button
                type="button"
                onClick={() => onImageChange('')}
                disabled={blocked}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <DropZone
            active={dragTarget === 'main'}
            busy={uploading}
            disabled={blocked}
            onDragOver={handleDragOver('main')}
            onDragLeave={() => setDragTarget(null)}
            onDrop={handleDrop('main')}
            label="Set product image"
            hint="Drop an image here or click to browse. PNG, JPG, or WEBP up to 8 MB."
          >
            <input type="file" accept={ACCEPT_ATTR} className="sr-only" disabled={blocked} onChange={handleInput('main')} />
          </DropZone>
        )}
      </PanelCard>

      <PanelCard title="Product gallery">
        <div className="grid grid-cols-3 gap-2">
          {galleryImages.map((src, i) => (
            <div key={`${i}-${src.slice(-24)}`} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onGalleryChange(galleryImages.filter((_, j) => j !== i))}
                disabled={blocked}
                aria-label="Remove gallery image"
                className="absolute right-1 top-1 rounded-full bg-white/95 p-1 text-slate-600 shadow transition hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className={galleryImages.length > 0 ? 'mt-3' : ''}>
          <DropZone
            active={dragTarget === 'gallery'}
            busy={uploading}
            disabled={blocked}
            onDragOver={handleDragOver('gallery')}
            onDragLeave={() => setDragTarget(null)}
            onDrop={handleDrop('gallery')}
            label="Add product gallery images"
            hint="Drop several images or click to browse."
            compact
          >
            <input type="file" accept={ACCEPT_ATTR} multiple className="sr-only" disabled={blocked} onChange={handleInput('gallery')} />
          </DropZone>
        </div>
      </PanelCard>
    </aside>
  )
}

function PanelCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  )
}

type DropZoneProps = {
  active: boolean
  busy: boolean
  disabled: boolean
  label: string
  hint: string
  compact?: boolean
  children: ReactNode
  onDragOver: (e: DragEvent<HTMLLabelElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLLabelElement>) => void
}

function DropZone({ active, busy, disabled, label, hint, compact, children, onDragOver, onDragLeave, onDrop }: DropZoneProps) {
  return (
    <label
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition ${
        compact ? 'py-4' : 'py-8'
      } ${
        active ? 'border-brand bg-brand/5' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : <ImagePlus className="h-5 w-5 text-slate-400" />}
      <span className="text-sm font-medium text-slate-700">{busy ? 'Uploading…' : label}</span>
      {!compact && <span className="text-xs text-slate-400">{hint}</span>}
      {children}
    </label>
  )
}
