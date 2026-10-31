import { useEffect, useState } from 'react'
import { X, Loader as Loader2, Save } from 'lucide-react'
import type { Product, DownloadableFile, ProductAttribute, ProductVariation } from '@/data/mockData'
import type { Category } from '@/lib/categories'
import type { WooConnection } from '@/lib/woocommerce'
import ProductFormTabs, { type ProductDraft } from '@/components/ProductFormTabs'

type AddProductModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  product: Product | null
  appMode: 'standalone' | 'woo'
  connection: WooConnection | null
  categories: Category[]
  onClose: () => void
  onSave: (data: Omit<Product, 'id' | 'unitsSold'>, id?: string) => void
}

function emptyDraft(): ProductDraft {
  return {
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
    downloads: [] as DownloadableFile[],
    downloadLimit: -1,
    downloadExpiry: -1,
    attributes: [] as ProductAttribute[],
    variations: [] as ProductVariation[],
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
}

function productToDraft(product: Product): ProductDraft {
  const { id: _id, unitsSold: _unitsSold, ...rest } = product
  void _id
  void _unitsSold
  return { ...rest }
}

export default function AddProductModal({
  open,
  mode,
  product,
  appMode,
  connection,
  categories,
  onClose,
  onSave,
}: AddProductModalProps) {
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(product ? productToDraft(product) : emptyDraft())
      setError('')
      setBusy(false)
    }
  }, [open, product])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !busy) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving, busy])

  if (!open) return null

  const handleSave = () => {
    if (!draft.name.trim()) {
      setError('Product name is required.')
      return
    }
    setSaving(true)
    try {
      onSave(draft, product?.id)
    } finally {
      setSaving(false)
    }
  }

  const blocked = saving || busy

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => !blocked && onClose()} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl sm:animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {mode === 'edit' ? 'Edit product' : 'Add new product'}
            </h3>
            <p className="text-sm text-slate-500">
              {mode === 'edit' ? 'Update the details of this product.' : 'Fill in the details to create a new product.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !blocked && onClose()}
            disabled={blocked}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ProductFormTabs
            draft={draft}
            setDraft={setDraft}
            categories={categories}
            appMode={appMode}
            connection={connection}
            busy={busy}
            setBusy={setBusy}
            error={error}
            setError={setError}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => !blocked && onClose()}
            disabled={blocked}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={blocked}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> {mode === 'edit' ? 'Update product' : 'Create product'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
