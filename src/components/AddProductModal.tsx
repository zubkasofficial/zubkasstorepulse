import { useEffect, useState } from 'react'
import { X, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react'
import type { Product } from '@/data/mockData'
import ProductImagesPanel from '@/components/ProductImagesPanel'
import {
  AdvancedTab, AttributesTab, Field, GeneralTab, InventoryTab, ShippingTab, VariationsTab, tabsForType,
  type ProductDraft, type ProductTab,
} from '@/components/ProductFormTabs'
import type { Category } from '@/lib/categories'
import type { WooConnection } from '@/lib/woocommerce'
import { uploadProductImage, type ImageUploadTarget } from '@/lib/productImages'

type AddProductModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  product: Product | null
  appMode: 'standalone' | 'woo'
  connection: WooConnection | null
  categories: Category[]
  onClose: () => void
  onSave: (data: ProductDraft, id?: string) => Promise<void>
}

const EMPTY_DRAFT: ProductDraft = {
  name: '',
  sku: '',
  gtin: '',
  category: '',
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

function validateDraft(draft: ProductDraft): Record<string, string> {
  const next: Record<string, string> = {}
  if (!draft.name.trim()) next.name = 'Enter a product name.'
  if (!Number.isFinite(draft.price) || draft.price < 0) next.price = 'Enter a valid price.'
  if (draft.salePrice !== null && (!Number.isFinite(draft.salePrice) || draft.salePrice < 0)) {
    next.salePrice = 'Enter a valid sale price.'
  } else if (draft.salePrice !== null && draft.salePrice >= draft.price) {
    next.salePrice = 'Sale price must be lower than the regular price.'
  }
  if (!Number.isFinite(draft.stock) || draft.stock < 0) next.stock = 'Enter a valid stock quantity.'
  return next
}

export default function AddProductModal({ open, mode, product, appMode, connection, categories, onClose, onSave }: AddProductModalProps) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState<ProductTab>('general')

  useEffect(() => {
    if (!open) return
    setDraft(mode === 'edit' && product ? product : EMPTY_DRAFT)
    setErrors({})
    setFormError('')
    setSaving(false)
    setActiveTab('general')
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

  const uploadVariationImage = async (file: File): Promise<string> => {
    const target: ImageUploadTarget = appMode === 'standalone' ? { mode: 'standalone' } : { mode: 'woo', connection }
    setUploading(true)
    try {
      const { url } = await uploadProductImage(file, target)
      return url
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || uploading) return
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setActiveTab(found.name || found.price || found.salePrice ? 'general' : 'inventory')
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
  const tabProps = { draft, errors, update }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-slate-50 shadow-xl sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:rounded-t-2xl">
          <div>
            <h2 id="add-product-title" className="font-display text-xl font-bold text-slate-900">
              {isEdit ? 'Edit product' : 'Add product'}
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <Field label="Product type">
                <select
                  value={draft.type}
                  onChange={(e) => {
                    const type = e.target.value as ProductDraft['type']
                    update('type', type)
                    if (type === 'simple' && activeTab === 'variations') setActiveTab('general')
                  }}
                  className="input-field"
                >
                  <option value="simple">Simple product</option>
                  <option value="variable">Variable product</option>
                </select>
              </Field>
              <div role="tablist" aria-label="Product data" className="flex gap-1 overflow-x-auto border-b border-slate-200">
                {tabsForType(draft.type).map((tab) => {
                  const selected = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(tab.key)}
                      className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                        selected
                          ? 'border-brand text-brand'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <section role="tabpanel" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {activeTab === 'general' && <GeneralTab {...tabProps} categories={categories} />}
                {activeTab === 'inventory' && <InventoryTab {...tabProps} />}
                {activeTab === 'shipping' && <ShippingTab {...tabProps} />}
                {activeTab === 'attributes' && <AttributesTab {...tabProps} />}
                {activeTab === 'variations' && draft.type === 'variable' && (
                  <VariationsTab {...tabProps} onUploadImage={uploadVariationImage} />
                )}
                {activeTab === 'advanced' && <AdvancedTab {...tabProps} />}
              </section>
            </div>

            <ProductImagesPanel
              imageUrl={draft.imageUrl}
              galleryImages={draft.galleryImages}
              disabled={saving}
              appMode={appMode}
              connection={connection}
              onImageChange={(url) => update('imageUrl', url)}
              onGalleryChange={(urls) => update('galleryImages', urls)}
              onBusyChange={setUploading}
              onError={setFormError}
            />
          </div>

          {formError && (
            <div className="mx-6 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:rounded-b-2xl">
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
              ) : isEdit ? 'Update product' : 'Publish product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
