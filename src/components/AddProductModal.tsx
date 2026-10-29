import { useEffect, useState } from 'react'
import { X, Loader as Loader2, ImagePlus, CircleAlert as AlertCircle } from 'lucide-react'
import { PRODUCT_CATEGORIES, formatCurrency, type Product, type Backorders } from '@/data/mockData'
import { uploadProductImage } from '@/lib/productImages'

type ProductDraft = Omit<Product, 'id' | 'unitsSold'>

type AddProductModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  product: Product | null
  appMode: 'standalone' | 'woo'
  onClose: () => void
  onSave: (data: ProductDraft, id?: string) => Promise<void>
}

const EMPTY_DRAFT: ProductDraft = {
  name: '',
  sku: '',
  gtin: '',
  category: PRODUCT_CATEGORIES[0],
  price: 0,
  salePrice: null,
  stock: 0,
  image: '',
  imageUrl: '',
  galleryImages: [],
  description: '',
  type: 'simple',
  virtual: false,
  downloadable: false,
  manageStock: true,
  stockStatus: 'instock',
  backorders: 'no',
  soldIndividually: false,
  unitOfMeasure: '',
  taxStatus: 'taxable',
  taxClass: '',
  saleStartDate: '',
  saleEndDate: '',
  downloads: [],
  downloadLimit: -1,
  downloadExpiry: -1,
  attributes: [],
  variations: [],
  tags: [],
  fullDescription: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  shippingClass: '',
  upsellIds: [],
  crossSellIds: [],
  purchaseNote: '',
  menuOrder: 0,
  reviewsEnabled: true,
  posAvailable: true,
}

const BACKORDER_OPTIONS: { value: Backorders; label: string }[] = [
  { value: 'no', label: 'Do not allow' },
  { value: 'notify', label: 'Allow, notify customer' },
  { value: 'yes', label: 'Allow' },
]

export default function AddProductModal({ open, mode, product, appMode, onClose, onSave }: AddProductModalProps) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(mode === 'edit' && product ? product : EMPTY_DRAFT)
    setErrors({})
    setFormError('')
    setSaving(false)
  }, [open, mode, product])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  if (!open) return null

  const update = <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!draft.name.trim()) next.name = 'Enter a product name.'
    if (!Number.isFinite(draft.price) || draft.price < 0) next.price = 'Enter a valid price.'
    if (draft.salePrice !== null && (!Number.isFinite(draft.salePrice) || draft.salePrice < 0)) {
      next.salePrice = 'Enter a valid sale price.'
    } else if (draft.salePrice !== null && draft.salePrice >= draft.price) {
      next.salePrice = 'Sale price must be lower than the regular price.'
    }
    if (!Number.isFinite(draft.stock) || draft.stock < 0) next.stock = 'Enter a valid stock quantity.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleImage = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setFormError('')
    try {
      const { url } = await uploadProductImage(file, 'product')
      update('imageUrl', url)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to upload image.')
    } finally {
      setUploading(false)
    }
  }

  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setFormError('')
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const { url } = await uploadProductImage(file, 'product')
        urls.push(url)
      }
      update('galleryImages', [...draft.galleryImages, ...urls])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to upload gallery image.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || uploading || !validate()) return
    if (appMode === 'woo' && [draft.imageUrl, ...draft.galleryImages].some((src) => src.startsWith('data:'))) {
      setFormError('Images could not be uploaded to your store yet. Check your connection and try again.')
      return
    }
    const data: ProductDraft = {
      ...draft,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      gtin: draft.gtin.trim(),
      stockStatus: draft.manageStock
        ? (draft.stock > 0 ? 'instock' : 'outofstock')
        : draft.stockStatus,
    }
    setSaving(true)
    setFormError('')
    try {
      await onSave(data, product?.id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save product.')
      setSaving(false)
    }
  }

  const isEdit = mode === 'edit'
  const salePriceInput = draft.salePrice === null ? '' : String(draft.salePrice)
  const showSaleInfo = draft.salePrice !== null && draft.salePrice < draft.price

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="add-product-title" className="font-display text-xl font-bold text-slate-900">
              {isEdit ? 'Edit Product' : 'Add Product'}
            </h2>
            <p className="text-sm text-slate-500">
              {appMode === 'woo' ? 'Changes are synced to your store.' : 'Saved to your standalone catalog.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Basic info</h3>
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                {draft.imageUrl ? (
                  <img src={draft.imageUrl} alt="Product" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {uploading ? 'Uploading…' : draft.imageUrl ? 'Replace image' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => handleImage(e.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-slate-400">PNG, JPG, or WEBP up to 8 MB.</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Gallery images</p>
              <div className="flex flex-wrap gap-2">
                {draft.galleryImages.map((src, i) => (
                  <div key={`${i}-${src.slice(0, 32)}`} className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => update('galleryImages', draft.galleryImages.filter((_, j) => j !== i))}
                      aria-label="Remove gallery image"
                      className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-600 shadow transition hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-600">
                  <ImagePlus className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => handleGalleryFiles(e.target.files)}
                  />
                </label>
              </div>
            </div>

            <Field label="Product name" error={errors.name}>
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                className="input-field"
                placeholder="e.g. Wireless Earbuds"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU">
                <input value={draft.sku} onChange={(e) => update('sku', e.target.value)} className="input-field font-mono" />
              </Field>
              <Field label="Barcode (GTIN)">
                <input value={draft.gtin} onChange={(e) => update('gtin', e.target.value)} className="input-field font-mono" />
              </Field>
            </div>

            <Field label="Category">
              <select value={draft.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                {PRODUCT_CATEGORIES.includes(draft.category) || !draft.category ? null : (
                  <option value={draft.category}>{draft.category}</option>
                )}
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                className="input-field"
              />
            </Field>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Regular price" error={errors.price}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(draft.price)}
                  onChange={(e) => update('price', Number(e.target.value))}
                  className="input-field"
                />
              </Field>
              <Field label="Sale price (optional)" error={errors.salePrice}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePriceInput}
                  onChange={(e) => update('salePrice', e.target.value === '' ? null : Number(e.target.value))}
                  className="input-field"
                />
              </Field>
            </div>
            {showSaleInfo && (
              <p className="flex items-center gap-1.5 text-xs text-green-600">
                Customers pay {formatCurrency(draft.salePrice ?? draft.price)} instead of {formatCurrency(draft.price)}.
              </p>
            )}
            <Field label="Tax status">
              <select
                value={draft.taxStatus}
                onChange={(e) => update('taxStatus', e.target.value as ProductDraft['taxStatus'])}
                className="input-field"
              >
                <option value="taxable">Taxable</option>
                <option value="none">None</option>
              </select>
            </Field>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory</h3>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.manageStock}
                onChange={(e) => update('manageStock', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
              />
              Track stock quantity
            </label>
            {draft.manageStock ? (
              <Field label="Stock quantity" error={errors.stock}>
                <input
                  type="number"
                  min="0"
                  value={String(draft.stock)}
                  onChange={(e) => update('stock', Number(e.target.value))}
                  className="input-field"
                />
              </Field>
            ) : (
              <Field label="Availability">
                <select
                  value={draft.stockStatus}
                  onChange={(e) => update('stockStatus', e.target.value as ProductDraft['stockStatus'])}
                  className="input-field"
                >
                  <option value="instock">In stock</option>
                  <option value="outofstock">Out of stock</option>
                </select>
              </Field>
            )}
            <Field label="When out of stock">
              <select
                value={draft.backorders}
                onChange={(e) => update('backorders', e.target.value as Backorders)}
                className="input-field"
              >
                {BACKORDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Visibility</h3>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.posAvailable}
                onChange={(e) => update('posAvailable', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
              />
              Available in POS
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.virtual}
                onChange={(e) => update('virtual', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
              />
              Virtual product (no shipping)
            </label>
          </section>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving || uploading} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : isEdit ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
