import { useEffect, useRef, useState } from 'react'
import { X, Loader as Loader2, Check, Package, Plus, Trash2, DollarSign, Boxes, Download, Layers, Image as ImageIcon2, CloudUpload as UploadCloud, Link as LinkIcon, CircleAlert as AlertCircle, RefreshCw, GitBranch, Truck, Settings } from 'lucide-react'
import { type Product, type ProductType, type TaxStatus, type Backorders, type DownloadableFile, type ProductAttribute, type ProductVariation } from '@/data/mockData'
import { useWoo } from '@/auth/WooContext'
import { fetchCategoriesFromCloud, type Category } from '@/lib/categories'

type Tab = 'general' | 'inventory' | 'shipping' | 'linked' | 'attributes' | 'variations' | 'advanced' | 'downloads' | 'media'

type ProductFormData = {
  name: string
  sku: string
  gtin: string
  category: string
  price: string
  salePrice: string
  saleStartDate: string
  saleEndDate: string
  taxStatus: TaxStatus
  taxClass: string
  stock: string
  manageStock: boolean
  stockStatus: 'instock' | 'outofstock'
  backorders: Backorders
  soldIndividually: boolean
  unitOfMeasure: string
  productType: ProductType
  virtual: boolean
  downloadable: boolean
  downloads: DownloadableFile[]
  downloadLimit: string
  downloadExpiry: string
  attributes: ProductAttribute[]
  variations: ProductVariation[]
  imageUrl: string
  tags: string
  description: string
  fullDescription: string
  weight: string
  length: string
  width: string
  height: string
  shippingClass: string
  upsellIds: string
  crossSellIds: string
  purchaseNote: string
  menuOrder: string
  reviewsEnabled: boolean
  posAvailable: boolean
}

type AddProductModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  product?: Product | null
  appMode: 'standalone' | 'woo'
  onClose: () => void
  onSave: (product: Omit<Product, 'id' | 'unitsSold'>, id?: string) => void
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  sku: '',
  gtin: '',
  category: '',
  price: '',
  salePrice: '',
  saleStartDate: '',
  saleEndDate: '',
  taxStatus: 'taxable',
  taxClass: '',
  stock: '',
  manageStock: true,
  stockStatus: 'instock',
  backorders: 'no',
  soldIndividually: false,
  unitOfMeasure: '',
  productType: 'simple',
  virtual: false,
  downloadable: false,
  downloads: [],
  downloadLimit: '',
  downloadExpiry: '',
  attributes: [],
  variations: [],
  imageUrl: '',
  tags: '',
  description: '',
  fullDescription: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  shippingClass: '',
  upsellIds: '',
  crossSellIds: '',
  purchaseNote: '',
  menuOrder: '0',
  reviewsEnabled: true,
  posAvailable: true,
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'general', label: 'General', icon: DollarSign },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'shipping', label: 'Shipping', icon: Truck },
  { key: 'linked', label: 'Linked', icon: LinkIcon },
  { key: 'attributes', label: 'Attributes', icon: Layers },
  { key: 'variations', label: 'Variations', icon: GitBranch },
  { key: 'advanced', label: 'Advanced', icon: Settings },
  { key: 'downloads', label: 'Downloads', icon: Download },
  { key: 'media', label: 'Media', icon: ImageIcon2 },
]

export default function AddProductModal({ open, mode, product, appMode, onClose, onSave }: AddProductModalProps) {
  const isWoo = appMode === 'woo'
  const { pushToast } = useWoo()
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  const [categories, setCategories] = useState<Category[]>([])

  // Image upload state
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetchCategoriesFromCloud().then((cats) => {
      const productName = mode === 'edit' && product ? product.category : ''
      const merged = productName && !cats.some((c) => c.name === productName)
        ? [...cats, { id: `local-${Date.now()}`, name: productName, slug: productName.toLowerCase(), createdAt: new Date().toISOString() }]
        : cats
      setCategories(merged)
      if (!mode || mode === 'create') {
        setForm((f) => (f.category ? f : { ...f, category: merged[0]?.name ?? '' }))
      }
    })
    if (mode === 'edit' && product) {
      setForm({
        name: product.name,
        sku: product.sku,
        gtin: product.gtin,
        category: product.category,
        price: String(product.price),
        salePrice: product.salePrice !== null ? String(product.salePrice) : '',
        saleStartDate: product.saleStartDate,
        saleEndDate: product.saleEndDate,
        taxStatus: product.taxStatus,
        taxClass: product.taxClass,
        stock: String(product.stock),
        manageStock: product.manageStock,
        stockStatus: product.stockStatus,
        backorders: product.backorders,
        soldIndividually: product.soldIndividually,
        unitOfMeasure: product.unitOfMeasure,
        productType: product.type,
        virtual: product.virtual,
        downloadable: product.downloadable,
        downloads: product.downloads,
        downloadLimit: product.downloadLimit ? String(product.downloadLimit) : '',
        downloadExpiry: product.downloadExpiry ? String(product.downloadExpiry) : '',
        attributes: product.attributes,
        variations: product.variations,
        imageUrl: product.imageUrl,
        tags: product.tags.join(', '),
        description: product.description,
        fullDescription: product.fullDescription,
        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,
        shippingClass: product.shippingClass,
        upsellIds: product.upsellIds.join(', '),
        crossSellIds: product.crossSellIds.join(', '),
        purchaseNote: product.purchaseNote,
        menuOrder: String(product.menuOrder),
        reviewsEnabled: product.reviewsEnabled,
        posAvailable: product.posAvailable,
      })
      setImagePreview(product.imageUrl)
    } else {
      setForm(EMPTY_FORM)
      setImagePreview('')
    }
    setErrors({})
    setTab('general')
    setUploadError('')
    setShowUrlInput(false)
    setUploading(false)
    setIsDragging(false)
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

  const update = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Enter a product title.'
    if (!form.sku.trim()) next.sku = 'Enter a SKU.'
    if (form.productType === 'simple') {
      const priceNum = Number(form.price)
      if (!form.price.trim()) next.price = 'Enter a regular price.'
      else if (isNaN(priceNum) || priceNum < 0) next.price = 'Enter a valid price.'
      if (form.salePrice.trim()) {
        const saleNum = Number(form.salePrice)
        if (isNaN(saleNum) || saleNum < 0) next.salePrice = 'Enter a valid sale price.'
        else if (priceNum > 0 && saleNum >= priceNum) next.salePrice = 'Sale price must be less than regular price.'
      }
    }
    if (form.productType === 'variable' && form.variations.length === 0) {
      next.variations = 'Generate at least one variation before saving.'
    }
    if (form.manageStock) {
      const stockNum = Number(form.stock)
      if (form.stock.trim() && (isNaN(stockNum) || stockNum < 0)) next.stock = 'Enter a valid stock quantity.'
    }
    if (form.downloadable) {
      for (const d of form.downloads) {
        if (d.name.trim() && !d.file.trim()) {
          next.downloads = 'Each file needs a URL.'
          break
        }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    window.setTimeout(() => {
      onSave(
        {
          name: form.name.trim(),
          sku: form.sku.trim(),
          gtin: form.gtin.trim(),
          category: form.category,
          price: Number(form.price),
          salePrice: form.salePrice.trim() ? Number(form.salePrice) : null,
          stock: form.manageStock && form.stock.trim() ? Number(form.stock) : 0,
          manageStock: form.manageStock,
          stockStatus: form.stockStatus,
          backorders: form.backorders,
          soldIndividually: form.soldIndividually,
          unitOfMeasure: form.unitOfMeasure.trim(),
          type: form.productType,
          virtual: form.virtual,
          downloadable: form.downloadable,
          taxStatus: form.taxStatus,
          taxClass: form.taxClass,
          saleStartDate: form.saleStartDate,
          saleEndDate: form.saleEndDate,
          downloads: form.downloadable ? form.downloads : [],
          downloadLimit: form.downloadable ? Number(form.downloadLimit) || 0 : 0,
          downloadExpiry: form.downloadable ? Number(form.downloadExpiry) || 0 : 0,
          attributes: form.productType === 'variable' ? form.attributes : [],
          variations: form.productType === 'variable' ? form.variations : [],
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          image: '📦',
          imageUrl: form.imageUrl.trim(),
          description: form.description.trim(),
          fullDescription: form.fullDescription.trim(),
          weight: form.weight.trim(),
          length: form.length.trim(),
          width: form.width.trim(),
          height: form.height.trim(),
          shippingClass: form.shippingClass,
          upsellIds: form.upsellIds.split(',').map((t) => t.trim()).filter(Boolean),
          crossSellIds: form.crossSellIds.split(',').map((t) => t.trim()).filter(Boolean),
          purchaseNote: form.purchaseNote.trim(),
          menuOrder: Number(form.menuOrder) || 0,
          reviewsEnabled: form.reviewsEnabled,
          posAvailable: form.posAvailable,
        },
        mode === 'edit' ? product?.id : undefined,
      )
      setSaving(false)
      setForm(EMPTY_FORM)
      setErrors({})
      onClose()
    }, 700)
  }

  const handleClose = () => {
    if (saving) return
    setForm(EMPTY_FORM)
    setErrors({})
    setImagePreview('')
    setUploadError('')
    setShowUrlInput(false)
    setUploading(false)
    onClose()
  }

  const handleFileSelect = (file: File) => {
    if (uploading) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a PNG, JPG, or WEBP image.')
      pushToast('error', 'Invalid file type. Use PNG, JPG, or WEBP.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image must be under 8 MB.')
      pushToast('error', 'Image too large. Maximum 8 MB.')
      return
    }

    setUploadError('')
    setUploading(true)

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      update('imageUrl', dataUrl)
      setUploading(false)
      pushToast('success', 'Image attached.')
    }
    reader.onerror = () => {
      setUploading(false)
      setUploadError('Failed to read the image file.')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleRemoveImage = () => {
    setImagePreview('')
    update('imageUrl', '')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Show downloads tab only if downloadable
  const visibleTabs = TABS.filter((t) => {
    if (t.key === 'downloads') return form.downloadable
    if (t.key === 'attributes') return form.productType === 'variable'
    if (t.key === 'variations') return form.productType === 'variable'
    if (t.key === 'linked') return isWoo
    if (t.key === 'advanced') return isWoo
    return true
  })

  const handleProductTypeChange = (type: ProductType) => {
    update('productType', type)
    if (type !== 'variable' && (tab === 'attributes' || tab === 'variations')) {
      setTab('general')
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-2xl animate-slide-in-right sm:max-w-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {mode === 'edit' ? 'Edit Product' : 'New Product'}
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {mode === 'edit' ? 'Edit Product Details' : 'Add Product'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5" noValidate>
          {/* Product title always at top */}
          <Field label="Product Title" htmlFor="p-name" error={errors.name}>
            <input
              id="p-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-field"
              placeholder="e.g. Aurora Wireless Earbuds"
            />
          </Field>

          {/* Product Type & Toggles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Product Type" htmlFor="p-type">
              <select
                id="p-type"
                value={form.productType}
                onChange={(e) => handleProductTypeChange(e.target.value as ProductType)}
                className="input-field"
              >
                <option value="simple">Simple product</option>
                <option value="variable">Variable product</option>
              </select>
            </Field>
            {isWoo && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.virtual}
                  onChange={(e) => update('virtual', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#9f0f0f] focus:ring-[#9f0f0f]/20"
                />
                <span className="text-sm font-medium text-slate-700">Virtual</span>
              </label>
            )}
            {isWoo && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.downloadable}
                  onChange={(e) => update('downloadable', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#9f0f0f] focus:ring-[#9f0f0f]/20"
                />
                <span className="text-sm font-medium text-slate-700">Downloadable</span>
              </label>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              {form.productType === 'variable' ? (
                <div className="rounded-xl border border-brand/20 bg-brand-50/40 px-4 py-3">
                  <p className="text-sm font-medium text-brand">Pricing is managed per variation</p>
                  <p className="mt-0.5 text-xs text-brand/70">
                    Go to the Variations tab to set the regular price, sale price, SKU, and stock for each individual variation.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Regular Price (₹)" htmlFor="p-price" error={errors.price}>
                    <input
                      id="p-price"
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => update('price', e.target.value)}
                      className="input-field"
                      placeholder="2499"
                    />
                  </Field>
                  <Field label="Sale Price (₹)" htmlFor="p-sale" error={errors.salePrice} hint="Optional">
                    <input
                      id="p-sale"
                      type="number"
                      min="0"
                      value={form.salePrice}
                      onChange={(e) => update('salePrice', e.target.value)}
                      className="input-field"
                      placeholder="1999"
                    />
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sale Start Date" htmlFor="p-sale-start" hint="Optional">
                  <input
                    id="p-sale-start"
                    type="date"
                    value={form.saleStartDate}
                    onChange={(e) => update('saleStartDate', e.target.value)}
                    className="input-field"
                  />
                </Field>
                <Field label="Sale End Date" htmlFor="p-sale-end" hint="Optional">
                  <input
                    id="p-sale-end"
                    type="date"
                    value={form.saleEndDate}
                    onChange={(e) => update('saleEndDate', e.target.value)}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tax Status" htmlFor="p-tax-status">
                  <select
                    id="p-tax-status"
                    value={form.taxStatus}
                    onChange={(e) => update('taxStatus', e.target.value as TaxStatus)}
                    className="input-field"
                  >
                    <option value="taxable">Taxable</option>
                    <option value="none">None</option>
                  </select>
                </Field>
                <Field label="Tax Class" htmlFor="p-tax-class" hint="Optional">
                  <select
                    id="p-tax-class"
                    value={form.taxClass}
                    onChange={(e) => update('taxClass', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Standard Rate</option>
                    <option value="zero-rate">Zero Rate</option>
                    <option value="reduced-rate">Reduced Rate</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {tab === 'inventory' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <Field label="SKU" htmlFor="p-sku" error={errors.sku}>
                  <input
                    id="p-sku"
                    value={form.sku}
                    onChange={(e) => update('sku', e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="SKU-XXX-000"
                  />
                </Field>
                <Field label="GTIN / UPC / ISBN" htmlFor="p-gtin" hint="Optional">
                  <input
                    id="p-gtin"
                    value={form.gtin}
                    onChange={(e) => update('gtin', e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="e.g. 012345678905"
                  />
                </Field>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">\n                  <Package className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Track stock quantity for this product</p>
                    <p className="text-xs text-slate-400">Enable stock management at the product level</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('manageStock', !form.manageStock)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    form.manageStock ? 'bg-brand' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.manageStock ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
              {form.manageStock && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <Field label="Initial number in stock" htmlFor="p-stock" error={errors.stock}>
                    <input
                      id="p-stock"
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => update('stock', e.target.value)}
                      className="input-field"
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Backorders" htmlFor="p-backorders">
                    <select
                      id="p-backorders"
                      value={form.backorders}
                      onChange={(e) => update('backorders', e.target.value as Backorders)}
                      className="input-field"
                    >
                      <option value="no">Do not allow</option>
                      <option value="notify">Allow, but notify customer</option>
                      <option value="yes">Allow</option>
                    </select>
                  </Field>
                </div>
              )}
              <Field label="Stock status" htmlFor="p-stock-status">
                <select
                  id="p-stock-status"
                  value={form.stockStatus}
                  onChange={(e) => update('stockStatus', e.target.value as 'instock' | 'outofstock')}
                  className="input-field"
                >
                  <option value="instock">In stock</option>
                  <option value="outofstock">Out of stock</option>
                  <option value="onbackorder">On backorder</option>
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.soldIndividually}
                    onChange={(e) => update('soldIndividually', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#9f0f0f] focus:ring-[#9f0f0f]/20"
                  />
                  <span className="text-sm font-medium text-slate-700">Sold individually</span>
                </label>
                <Field label="Unit of measure" htmlFor="p-unit" hint="Optional">
                  <input
                    id="p-unit"
                    value={form.unitOfMeasure}
                    onChange={(e) => update('unitOfMeasure', e.target.value)}
                    className="input-field"
                    placeholder="e.g. pcs, kg, litre"
                  />
                </Field>
              </div>
            </div>
          )}

          {tab === 'downloads' && form.downloadable && (
            <div className="space-y-4 animate-fade-in">
              {errors.downloads && <p className="text-sm text-red-600">{errors.downloads}</p>}
              <div className="space-y-3">
                {form.downloads.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex-1 space-y-2">
                      <input
                        value={d.name}
                        onChange={(e) => {
                          const next = [...form.downloads]
                          next[i] = { ...d, name: e.target.value }
                          update('downloads', next)
                        }}
                        className="input-field text-sm"
                        placeholder="File name (e.g. Product Manual)"
                      />
                      <input
                        value={d.file}
                        onChange={(e) => {
                          const next = [...form.downloads]
                          next[i] = { ...d, file: e.target.value }
                          update('downloads', next)
                        }}
                        className="input-field text-sm"
                        placeholder="File URL (https://…)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => update('downloads', form.downloads.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => update('downloads', [...form.downloads, { id: String(Date.now()), name: '', file: '' }])}
                className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand"
              >
                <Plus className="h-4 w-4" /> Add File
              </button>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Download Limit" htmlFor="p-dl-limit" hint="0 = Unlimited">
                  <input
                    id="p-dl-limit"
                    type="number"
                    min="0"
                    value={form.downloadLimit}
                    onChange={(e) => update('downloadLimit', e.target.value)}
                    className="input-field"
                    placeholder="0"
                  />
                </Field>
                <Field label="Download Expiry (days)" htmlFor="p-dl-expiry" hint="0 = Never">
                  <input
                    id="p-dl-expiry"
                    type="number"
                    min="0"
                    value={form.downloadExpiry}
                    onChange={(e) => update('downloadExpiry', e.target.value)}
                    className="input-field"
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>
          )}

          {tab === 'attributes' && form.productType === 'variable' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-slate-500">
                Add attributes used for variations (e.g. Size: S, M, L). Enable "Used for variations" to generate variation combinations.
              </p>
              <div className="space-y-3">
                {form.attributes.map((attr, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={attr.name}
                        onChange={(e) => {
                          const next = [...form.attributes]
                          next[i] = { ...attr, name: e.target.value }
                          update('attributes', next)
                        }}
                        className="input-field text-sm"
                        placeholder="Attribute name (e.g. Size)"
                      />
                      <button
                        type="button"
                        onClick={() => update('attributes', form.attributes.filter((_, idx) => idx !== i))}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <AttributeTagInput
                      options={attr.options}
                      onChange={(options) => {
                        const next = [...form.attributes]
                        next[i] = { ...attr, options }
                        update('attributes', next)
                      }}
                    />
                    {form.productType === 'variable' && (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={attr.variation}
                          onChange={(e) => {
                            const next = [...form.attributes]
                            next[i] = { ...attr, variation: e.target.checked }
                            update('attributes', next)
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-[#9f0f0f] focus:ring-[#9f0f0f]/20"
                        />
                        Used for variations
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => update('attributes', [...form.attributes, { id: 0, name: '', position: form.attributes.length, visible: true, variation: form.productType === 'variable', options: [] }])}
                className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand/30 hover:bg-brand-50/30 hover:text-brand"
              >
                <Plus className="h-4 w-4" /> Add Attribute
              </button>
            </div>
          )}

          {tab === 'variations' && form.productType === 'variable' && (
            <div className="space-y-4 animate-fade-in">
              {form.attributes.some((a) => a.variation && a.options.length > 0) ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Generate and manage individual variations. Each has its own SKU, price, and stock status.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const variationAttrs = form.attributes.filter((a) => a.variation && a.options.length > 0)
                        if (variationAttrs.length === 0) return
                        const combos = generateCombinations(variationAttrs)
                        const newVariations: ProductVariation[] = combos.map((combo) => ({
                          id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          sku: '',
                          price: form.price,
                          salePrice: form.salePrice.trim() ? form.salePrice : null,
                          stockStatus: 'instock',
                          attributes: combo,
                        }))
                        update('variations', newVariations)
                      }}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#9f0f0f] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#880d0d]"
                    >
                      <Layers className="h-3.5 w-3.5" /> Generate Variations
                    </button>
                  </div>

                  {form.variations.length > 0 ? (
                    <div className="space-y-2">
                      {form.variations.map((v, i) => (
                        <div key={v.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">
                              {v.attributes.map((a) => `${a.name}: ${a.option}`).join(' · ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => update('variations', form.variations.filter((_, idx) => idx !== i))}
                              className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <input
                              value={v.sku}
                              onChange={(e) => {
                                const next = [...form.variations]
                                next[i] = { ...v, sku: e.target.value }
                                update('variations', next)
                              }}
                              className="input-field text-xs font-mono"
                              placeholder="SKU"
                            />
                            <input
                              value={v.price}
                              onChange={(e) => {
                                const next = [...form.variations]
                                next[i] = { ...v, price: e.target.value }
                                update('variations', next)
                              }}
                              type="number"
                              min="0"
                              className="input-field text-xs"
                              placeholder="Regular ₹"
                            />
                            <input
                              value={v.salePrice ?? ''}
                              onChange={(e) => {
                                const next = [...form.variations]
                                next[i] = { ...v, salePrice: e.target.value || null }
                                update('variations', next)
                              }}
                              type="number"
                              min="0"
                              className="input-field text-xs"
                              placeholder="Sale ₹"
                            />
                            <select
                              value={v.stockStatus ?? 'instock'}
                              onChange={(e) => {
                                const next = [...form.variations]
                                next[i] = { ...v, stockStatus: e.target.value as 'instock' | 'outofstock' }
                                update('variations', next)
                              }}
                              className="input-field text-xs"
                            >
                              <option value="instock">In stock</option>
                              <option value="outofstock">Out of stock</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
                      <Layers className="h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-400">No variations generated yet.</p>
                      <p className="text-xs text-slate-400">Click "Generate Variations" to create all combinations from your attributes.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
                  <Layers className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-400">No variation attributes found.</p>
                  <p className="text-xs text-slate-400">Go to the Attributes tab, add an attribute, and enable "Used for variations".</p>
                </div>
              )}
            </div>
          )}

          {tab === 'shipping' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Weight (kg)" htmlFor="p-weight" hint="Optional">
                  <input id="p-weight" type="number" min="0" step="0.01" className="input-field" placeholder="0.5" />
                </Field>
                <Field label="Dimensions (L×W×H cm)" htmlFor="p-dims" hint="Optional">
                  <input id="p-dims" className="input-field" placeholder="10 × 10 × 5" />
                </Field>
              </div>
              <Field label="Shipping Class" htmlFor="p-shipping-class">
                <select id="p-shipping-class" className="input-field">
                  <option value="">No shipping class</option>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="heavy">Heavy Items</option>
                </select>
              </Field>
              <p className="text-xs text-slate-400">Shipping settings apply to physical products. Virtual products are not shipped.</p>
            </div>
          )}

          {tab === 'linked' && (
            <div className="space-y-4 animate-fade-in">
              <Field label="Upsells" htmlFor="p-upsells" hint="Optional">
                <input id="p-upsells" className="input-field" placeholder="Search for products to upsell…" />
              </Field>
              <Field label="Cross-sells" htmlFor="p-crosssells" hint="Optional">
                <input id="p-crosssells" className="input-field" placeholder="Search for products to cross-sell…" />
              </Field>
              <Field label="Grouped Products" htmlFor="p-grouped" hint="Optional">
                <input id="p-grouped" className="input-field" placeholder="Search for products to group…" />
              </Field>
              <p className="text-xs text-slate-400">Linked products help customers discover related items in your store.</p>
            </div>
          )}

          {tab === 'advanced' && (
            <div className="space-y-4 animate-fade-in">
              <Field label="Menu Order" htmlFor="p-menu-order" hint="0 = default">
                <input id="p-menu-order" type="number" min="0" className="input-field" placeholder="0" />
              </Field>
              <Field label="Purchase Note" htmlFor="p-purchase-note" hint="Optional">
                <textarea id="p-purchase-note" rows={2} className="input-field resize-none" placeholder="Note shown to customer after purchase…" />
              </Field>
              <Field label="Reviews" htmlFor="p-reviews">
                <select id="p-reviews" className="input-field">
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </Field>
              <Field label="Visibility" htmlFor="p-visibility">
                <select id="p-visibility" className="input-field">
                  <option value="visible">Publicly visible</option>
                  <option value="catalog">Catalog only</option>
                  <option value="search">Search results only</option>
                  <option value="hidden">Hidden</option>
                </select>
              </Field>
            </div>
          )}

          {tab === 'media' && (
            <div className="space-y-4 animate-fade-in">
              {/* Image upload / preview */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Featured Image</label>

                {imagePreview ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-4 p-4">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img src={imagePreview} alt="Product preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        {uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                            <Loader2 className="h-6 w-6 animate-spin text-[#9f0f0f]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">
                          {uploading ? 'Processing image…' : 'Image selected'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {uploading ? 'Please wait while the image is processed.' : 'Click replace to choose a different image.'}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#9f0f0f]/30 hover:bg-[#9f0f0f]/5 hover:text-[#9f0f0f] disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Change Image
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={uploading}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                      isDragging
                        ? 'border-[#9f0f0f] bg-[#9f0f0f]/5'
                        : 'border-slate-300 bg-slate-50 hover:border-[#9f0f0f]/40 hover:bg-[#9f0f0f]/5'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-[#9f0f0f]" />
                        <p className="mt-3 text-sm font-medium text-slate-600">Processing image…</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-slate-400" />
                        <p className="mt-3 text-sm font-medium text-slate-600">Drag & drop an image here</p>
                        <p className="mt-0.5 text-xs text-slate-400">or click to browse · PNG, JPG, WEBP (max 8 MB)</p>
                      </>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                />

                {uploadError && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 animate-fade-in">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* URL toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowUrlInput((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#9f0f0f] transition hover:text-[#880d0d]"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {showUrlInput ? 'Hide URL input' : 'Or enter an image URL instead'}
                </button>
                {showUrlInput && (
                  <div className="mt-2 animate-fade-in">
                    <Field label="Featured Image URL" htmlFor="p-image">
                      <input
                        id="p-image"
                        type="url"
                        value={form.imageUrl}
                        onChange={(e) => {
                          update('imageUrl', e.target.value)
                          setImagePreview(e.target.value)
                        }}
                        className="input-field"
                        placeholder="https://example.com/product.jpg"
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category" htmlFor="p-category">
                  <select
                    id="p-category"
                    value={form.category}
                    onChange={(e) => update('category', e.target.value)}
                    className="input-field"
                  >
                    {categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      <option value="">Loading categories…</option>
                    )}
                  </select>
                </Field>
                <Field label="Product Tags" htmlFor="p-tags" hint="Comma separated">
                  <input
                    id="p-tags"
                    value={form.tags}
                    onChange={(e) => update('tags', e.target.value)}
                    className="input-field"
                    placeholder="earbuds, wireless, audio"
                  />
                </Field>
              </div>
              <Field label="Short Description" htmlFor="p-desc">
                <textarea
                  id="p-desc"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Brief description shown on product listing…"
                />
              </Field>
              <Field label="Full Description" htmlFor="p-full-desc">
                <textarea
                  id="p-full-desc"
                  value={form.fullDescription}
                  onChange={(e) => update('fullDescription', e.target.value)}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Full product description shown on the product page…"
                />
              </Field>
            </div>
          )}

          {errors.variations && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errors.variations}</span>
            </div>
          )}

          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f0f0f] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#9f0f0f]/20 transition hover:bg-[#880d0d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {mode === 'edit' ? 'Updating…' : 'Publishing…'}</>
            ) : (
              <><Check className="h-4 w-4" /> {mode === 'edit' ? 'Save Changes' : 'Save & Publish to Store'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function generateCombinations(attrs: ProductAttribute[]): Array<Array<{ name: string; option: string }>> {
  if (attrs.length === 0) return []
  const result: Array<Array<{ name: string; option: string }>> = []
  function backtrack(idx: number, current: Array<{ name: string; option: string }>) {
    if (idx === attrs.length) {
      result.push([...current])
      return
    }
    for (const opt of attrs[idx].options) {
      current.push({ name: attrs[idx].name, option: opt })
      backtrack(idx + 1, current)
      current.pop()
    }
  }
  backtrack(0, [])
  return result
}

/* ---------------- Field ---------------- */

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="relative">{children}</div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function AttributeTagInput({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !options.includes(tag)) {
      onChange([...options, tag])
    }
    setInputValue('')
  }

  const removeTag = (tag: string) => {
    onChange(options.filter((o) => o !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) addTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && options.length > 0) {
      removeTag(options[options.length - 1])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(',')) {
      const parts = val.split(',').map((p) => p.trim()).filter(Boolean)
      const newTags = parts.filter((p) => !options.includes(p))
      if (newTags.length > 0) {
        onChange([...options, ...newTags])
      }
      setInputValue('')
    } else {
      setInputValue(val)
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) addTag(inputValue)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 min-h-[42px] focus-within:border-[#9f0f0f]/40 focus-within:ring-2 focus-within:ring-[#9f0f0f]/10">
      {options.map((opt) => (
        <span
          key={opt}
          className="inline-flex items-center gap-1 rounded-lg bg-[#9f0f0f]/10 px-2 py-1 text-xs font-medium text-[#9f0f0f] animate-fade-in"
        >
          {opt}
          <button
            type="button"
            onClick={() => removeTag(opt)}
            className="rounded p-0.5 transition hover:bg-[#9f0f0f]/20"
            aria-label={`Remove ${opt}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 min-w-[120px] border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        placeholder={options.length === 0 ? 'Type a value and press Enter (or comma)' : 'Add another…'}
      />
    </div>
  )
}
