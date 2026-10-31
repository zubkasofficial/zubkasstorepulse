import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type {
  Product,
  ProductType,
  TaxStatus,
  Backorders,
  DownloadableFile,
  ProductAttribute,
  ProductVariation,
} from '@/data/mockData'
import type { Category } from '@/lib/categories'
import type { WooConnection } from '@/lib/woocommerce'
import ProductImagesPanel from '@/components/ProductImagesPanel'
import DownloadableFilesEditor from '@/components/DownloadableFilesEditor'
import { uploadDownloadableFile, type ImageUploadTarget } from '@/lib/productImages'

export type ProductDraft = Omit<Product, 'id' | 'unitsSold'> & {
  downloads: DownloadableFile[]
  attributes: ProductAttribute[]
  variations: ProductVariation[]
  tags: string[]
}

type ProductFormTabsProps = {
  draft: ProductDraft
  setDraft: (updater: (prev: ProductDraft) => ProductDraft) => void
  categories: Category[]
  appMode: 'standalone' | 'woo'
  connection: WooConnection | null
  busy: boolean
  setBusy: (busy: boolean) => void
  error: string
  setError: (error: string) => void
}

type TabKey = 'general' | 'pricing' | 'inventory' | 'shipping' | 'linked' | 'attributes' | 'advanced'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'linked', label: 'Linked Products' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'advanced', label: 'Advanced' },
]

export default function ProductFormTabs({
  draft,
  setDraft,
  categories,
  appMode,
  connection,
  busy,
  setBusy,
  error,
  setError,
}: ProductFormTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  const patch = (change: Partial<ProductDraft>) =>
    setDraft((prev) => ({ ...prev, ...change }))

  const uploadTarget: ImageUploadTarget = appMode === 'standalone' ? { mode: 'standalone' } : { mode: 'woo', connection }

  const handleUploadFile = async (file: File): Promise<string> => {
    return uploadDownloadableFile(file, uploadTarget)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {/* Tab nav */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-4">
            <Field label="Product name" required>
              <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="input-field"
                placeholder="e.g. Wireless Headphones"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU">
                <input
                  value={draft.sku}
                  onChange={(e) => patch({ sku: e.target.value })}
                  className="input-field"
                  placeholder="e.g. WH-1000"
                />
              </Field>
              <Field label="GTIN / UPC / EAN">
                <input
                  value={draft.gtin}
                  onChange={(e) => patch({ gtin: e.target.value })}
                  className="input-field"
                  placeholder="0123456789012"
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value })}
                className="input-field"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Short description">
              <textarea
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="A short summary shown on product listings"
              />
            </Field>
            <Field label="Full description">
              <textarea
                value={draft.fullDescription}
                onChange={(e) => patch({ fullDescription: e.target.value })}
                className="input-field min-h-[140px]"
                placeholder="The full product description shown on the product page"
              />
            </Field>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Regular price (₹)" required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(draft.price) ? draft.price : 0}
                  onChange={(e) => patch({ price: Number(e.target.value) || 0 })}
                  className="input-field"
                />
              </Field>
              <Field label="Sale price (₹)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.salePrice ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    patch({ salePrice: v === '' ? null : Number(v) || 0 })
                  }}
                  className="input-field"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sale start date">
                <input
                  type="date"
                  value={draft.saleStartDate}
                  onChange={(e) => patch({ saleStartDate: e.target.value })}
                  className="input-field"
                />
              </Field>
              <Field label="Sale end date">
                <input
                  type="date"
                  value={draft.saleEndDate}
                  onChange={(e) => patch({ saleEndDate: e.target.value })}
                  className="input-field"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tax status">
                <select
                  value={draft.taxStatus}
                  onChange={(e) => patch({ taxStatus: e.target.value as TaxStatus })}
                  className="input-field"
                >
                  <option value="taxable">Taxable</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Tax class">
                <input
                  value={draft.taxClass}
                  onChange={(e) => patch({ taxClass: e.target.value })}
                  className="input-field"
                  placeholder="Standard"
                />
              </Field>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product type">
                <select
                  value={draft.type}
                  onChange={(e) => patch({ type: e.target.value as ProductType })}
                  className="input-field"
                >
                  <option value="simple">Simple</option>
                  <option value="variable">Variable</option>
                </select>
              </Field>
              <Field label="Stock status">
                <select
                  value={draft.stockStatus}
                  onChange={(e) =>
                    patch({ stockStatus: e.target.value as 'instock' | 'outofstock' })
                  }
                  className="input-field"
                >
                  <option value="instock">In stock</option>
                  <option value="outofstock">Out of stock</option>
                </select>
              </Field>
            </div>
            {draft.type !== 'variable' && (
              <Field label="Stock quantity">
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(draft.stock) ? draft.stock : 0}
                  onChange={(e) => patch({ stock: Number(e.target.value) || 0 })}
                  className="input-field"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Backorders">
                <select
                  value={draft.backorders}
                  onChange={(e) => patch({ backorders: e.target.value as Backorders })}
                  className="input-field"
                >
                  <option value="no">Do not allow</option>
                  <option value="notify">Allow, but notify customer</option>
                  <option value="yes">Allow</option>
                </select>
              </Field>
              <Field label="Unit of measure">
                <input
                  value={draft.unitOfMeasure}
                  onChange={(e) => patch({ unitOfMeasure: e.target.value })}
                  className="input-field"
                  placeholder="e.g. pcs, kg"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle
                label="Manage stock"
                checked={draft.manageStock}
                onChange={(v) => patch({ manageStock: v })}
              />
              <Toggle
                label="Sold individually"
                checked={draft.soldIndividually}
                onChange={(v) => patch({ soldIndividually: v })}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle
                label="Virtual product"
                checked={draft.virtual}
                onChange={(v) => patch({ virtual: v })}
              />
              <Toggle
                label="Downloadable"
                checked={draft.downloadable}
                onChange={(v) => patch({ downloadable: v })}
              />
            </div>
            {draft.downloadable && (
              <div className="space-y-3">
                <DownloadableFilesEditor
                  downloads={draft.downloads}
                  onChange={(downloads) => patch({ downloads })}
                  onUploadFile={handleUploadFile}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Download limit">
                    <input
                      type="number"
                      min={-1}
                      value={draft.downloadLimit}
                      onChange={(e) => patch({ downloadLimit: Number(e.target.value) || 0 })}
                      className="input-field"
                      placeholder="-1 for unlimited"
                    />
                  </Field>
                  <Field label="Download expiry (days)">
                    <input
                      type="number"
                      min={-1}
                      value={draft.downloadExpiry}
                      onChange={(e) => patch({ downloadExpiry: Number(e.target.value) || 0 })}
                      className="input-field"
                      placeholder="-1 for never"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Weight">
                <input
                  value={draft.weight}
                  onChange={(e) => patch({ weight: e.target.value })}
                  className="input-field"
                  placeholder="0.5"
                />
              </Field>
              <Field label="Length">
                <input
                  value={draft.length}
                  onChange={(e) => patch({ length: e.target.value })}
                  className="input-field"
                  placeholder="cm"
                />
              </Field>
              <Field label="Width">
                <input
                  value={draft.width}
                  onChange={(e) => patch({ width: e.target.value })}
                  className="input-field"
                  placeholder="cm"
                />
              </Field>
              <Field label="Height">
                <input
                  value={draft.height}
                  onChange={(e) => patch({ height: e.target.value })}
                  className="input-field"
                  placeholder="cm"
                />
              </Field>
            </div>
            <Field label="Shipping class">
              <input
                value={draft.shippingClass}
                onChange={(e) => patch({ shippingClass: e.target.value })}
                className="input-field"
                placeholder="e.g. standard"
              />
            </Field>
          </div>
        )}

        {activeTab === 'linked' && (
          <div className="space-y-4">
            <Field label="Upsell IDs (comma separated)">
              <input
                value={draft.upsellIds.join(', ')}
                onChange={(e) =>
                  patch({
                    upsellIds: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="input-field"
                placeholder="e.g. 12, 34"
              />
            </Field>
            <Field label="Cross-sell IDs (comma separated)">
              <input
                value={draft.crossSellIds.join(', ')}
                onChange={(e) =>
                  patch({
                    crossSellIds: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="input-field"
                placeholder="e.g. 56, 78"
              />
            </Field>
            <Field label="Tags (comma separated)">
              <input
                value={draft.tags.join(', ')}
                onChange={(e) =>
                  patch({
                    tags: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="input-field"
                placeholder="e.g. audio, wireless"
              />
            </Field>
          </div>
        )}

        {activeTab === 'attributes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Product attributes</p>
              <button
                type="button"
                onClick={() =>
                  patch({
                    attributes: [
                      ...draft.attributes,
                      {
                        id: Date.now(),
                        name: '',
                        position: draft.attributes.length,
                        visible: true,
                        variation: false,
                        options: [],
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Add attribute
              </button>
            </div>
            {draft.attributes.length === 0 && (
              <p className="text-sm text-slate-400">No attributes yet.</p>
            )}
            {draft.attributes.map((attr, i) => (
              <div key={attr.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Attribute {i + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        attributes: draft.attributes.filter((_, j) => j !== i),
                      })
                    }
                    aria-label="Remove attribute"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={attr.name}
                      onChange={(e) => {
                        const next = [...draft.attributes]
                        next[i] = { ...attr, name: e.target.value }
                        patch({ attributes: next })
                      }}
                      className="input-field"
                      placeholder="e.g. Color"
                    />
                  </Field>
                  <Field label="Options (comma separated)">
                    <input
                      value={attr.options.join(', ')}
                      onChange={(e) => {
                        const next = [...draft.attributes]
                        next[i] = {
                          ...attr,
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }
                        patch({ attributes: next })
                      }}
                      className="input-field"
                      placeholder="e.g. Red, Blue"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-6">
                  <Toggle
                    label="Visible on product page"
                    checked={attr.visible}
                    onChange={(v) => {
                      const next = [...draft.attributes]
                      next[i] = { ...attr, visible: v }
                      patch({ attributes: next })
                    }}
                  />
                  <Toggle
                    label="Used for variations"
                    checked={attr.variation}
                    onChange={(v) => {
                      const next = [...draft.attributes]
                      next[i] = { ...attr, variation: v }
                      patch({ attributes: next })
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            <Field label="Purchase note">
              <textarea
                value={draft.purchaseNote}
                onChange={(e) => patch({ purchaseNote: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="Shown to the customer after purchase"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Menu order">
                <input
                  type="number"
                  value={draft.menuOrder}
                  onChange={(e) => patch({ menuOrder: Number(e.target.value) || 0 })}
                  className="input-field"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle
                label="Enable reviews"
                checked={draft.reviewsEnabled}
                onChange={(v) => patch({ reviewsEnabled: v })}
              />
              <Toggle
                label="Available in POS"
                checked={draft.posAvailable}
                onChange={(v) => patch({ posAvailable: v })}
              />
            </div>
          </div>
        )}
      </div>

      <ProductImagesPanel
        imageUrl={draft.imageUrl}
        galleryImages={draft.galleryImages}
        disabled={busy}
        appMode={appMode}
        connection={connection}
        onImageChange={(url) => patch({ imageUrl: url })}
        onGalleryChange={(urls) => patch({ galleryImages: urls })}
        onBusyChange={setBusy}
        onError={setError}
      />
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}
