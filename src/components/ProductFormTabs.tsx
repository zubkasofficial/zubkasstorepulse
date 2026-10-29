import { Plus, Trash2 } from 'lucide-react'
import { formatCurrency, type Backorders, type Product, type ProductAttribute } from '@/data/mockData'
import type { Category } from '@/lib/categories'

export type ProductDraft = Omit<Product, 'id' | 'unitsSold'>

export type ProductTab = 'general' | 'inventory' | 'shipping' | 'attributes' | 'advanced'

export const PRODUCT_TABS: { key: ProductTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'advanced', label: 'Advanced' },
]

type TabProps = {
  draft: ProductDraft
  errors: Record<string, string>
  update: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void
}

const BACKORDER_OPTIONS: { value: Backorders; label: string }[] = [
  { value: 'no', label: 'Do not allow' },
  { value: 'notify', label: 'Allow, notify customer' },
  { value: 'yes', label: 'Allow' },
]

const CHECKBOX_CLASS = 'h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30'

export function GeneralTab({ draft, errors, update, categories }: TabProps & { categories: Category[] }) {
  const salePriceInput = draft.salePrice === null ? '' : String(draft.salePrice)
  const showSaleInfo = draft.salePrice !== null && draft.salePrice < draft.price

  return (
    <div className="space-y-4">
      <Field label="Product name" error={errors.name}>
        <input
          value={draft.name}
          onChange={(e) => update('name', e.target.value)}
          className="input-field"
          placeholder="e.g. Wireless Earbuds"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          rows={4}
          className="input-field"
        />
      </Field>
      <Field label="Category">
        <select value={draft.category} onChange={(e) => update('category', e.target.value)} className="input-field">
          <option value="">No category</option>
          {draft.category && !categories.some((c) => c.name === draft.category) && (
            <option value={draft.category}>{draft.category}</option>
          )}
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        {categories.length === 0 && (
          <p className="mt-1.5 text-xs text-slate-400">Create categories in the Categories tab to choose one here.</p>
        )}
      </Field>
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
        <p className="text-xs text-green-600">
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
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.virtual} onChange={(e) => update('virtual', e.target.checked)} className={CHECKBOX_CLASS} />
          Virtual (no shipping)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.downloadable} onChange={(e) => update('downloadable', e.target.checked)} className={CHECKBOX_CLASS} />
          Downloadable
        </label>
      </div>
    </div>
  )
}

export function InventoryTab({ draft, errors, update }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU (optional)">
          <input value={draft.sku} onChange={(e) => update('sku', e.target.value)} className="input-field font-mono" />
        </Field>
        <Field label="Barcode (GTIN, optional)">
          <input value={draft.gtin} onChange={(e) => update('gtin', e.target.value)} className="input-field font-mono" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.manageStock} onChange={(e) => update('manageStock', e.target.checked)} className={CHECKBOX_CLASS} />
        Manage stock quantity
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Stock status">
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
        {draft.manageStock && (
          <Field label="Allow backorders?">
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
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.soldIndividually} onChange={(e) => update('soldIndividually', e.target.checked)} className={CHECKBOX_CLASS} />
        Sold individually (one per order)
      </label>
    </div>
  )
}

export function ShippingTab({ draft, update }: TabProps) {
  return (
    <div className="space-y-4">
      {draft.virtual && (
        <p className="text-xs text-slate-500">Virtual products don't need shipping details.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Weight (kg)">
          <input inputMode="decimal" value={draft.weight} onChange={(e) => update('weight', e.target.value)} className="input-field" />
        </Field>
        <Field label="Shipping class">
          <input value={draft.shippingClass} onChange={(e) => update('shippingClass', e.target.value)} className="input-field" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Length (cm)">
          <input inputMode="decimal" value={draft.length} onChange={(e) => update('length', e.target.value)} className="input-field" />
        </Field>
        <Field label="Width (cm)">
          <input inputMode="decimal" value={draft.width} onChange={(e) => update('width', e.target.value)} className="input-field" />
        </Field>
        <Field label="Height (cm)">
          <input inputMode="decimal" value={draft.height} onChange={(e) => update('height', e.target.value)} className="input-field" />
        </Field>
      </div>
    </div>
  )
}

export function AttributesTab({ draft, update }: TabProps) {
  const setAttributes = (next: ProductAttribute[]) =>
    update('attributes', next.map((a, i) => ({ ...a, position: i })))

  const patchAttribute = (index: number, change: Partial<ProductAttribute>) =>
    setAttributes(draft.attributes.map((a, j) => (j === index ? { ...a, ...change } : a)))

  const addAttribute = () => {
    const nextId = draft.attributes.reduce((max, a) => Math.max(max, a.id), 0) + 1
    setAttributes([
      ...draft.attributes,
      { id: nextId, name: '', position: draft.attributes.length, visible: true, variation: false, options: [] },
    ])
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Attributes describe details such as size or material and appear on the product page.
      </p>
      {draft.attributes.length === 0 && <p className="text-sm text-slate-400">No attributes yet.</p>}
      {draft.attributes.map((attr, i) => (
        <div key={attr.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={attr.name} onChange={(e) => patchAttribute(i, { name: e.target.value })} className="input-field" placeholder="e.g. Size" />
            </Field>
            <Field label="Values (comma separated)">
              <input
                defaultValue={attr.options.join(', ')}
                onBlur={(e) => patchAttribute(i, { options: parseOptions(e.target.value) })}
                className="input-field"
                placeholder="e.g. S, M, L"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={attr.visible} onChange={(e) => patchAttribute(i, { visible: e.target.checked })} className={CHECKBOX_CLASS} />
              Show on product page
            </label>
            <button
              type="button"
              onClick={() => setAttributes(draft.attributes.filter((_, j) => j !== i))}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addAttribute}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" /> Add attribute
      </button>
    </div>
  )
}

export function AdvancedTab({ draft, update }: TabProps) {
  return (
    <div className="space-y-4">
      <Field label="Purchase note">
        <textarea value={draft.purchaseNote} onChange={(e) => update('purchaseNote', e.target.value)} rows={3} className="input-field" />
      </Field>
      <Field label="Menu order">
        <input
          type="number"
          value={String(draft.menuOrder)}
          onChange={(e) => update('menuOrder', Number(e.target.value))}
          className="input-field sm:w-40"
        />
      </Field>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.reviewsEnabled} onChange={(e) => update('reviewsEnabled', e.target.checked)} className={CHECKBOX_CLASS} />
          Enable customer reviews
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.posAvailable} onChange={(e) => update('posAvailable', e.target.checked)} className={CHECKBOX_CLASS} />
          Available in POS
        </label>
      </div>
    </div>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function parseOptions(value: string): string[] {
  return value.split(',').map((o) => o.trim()).filter(Boolean)
}
