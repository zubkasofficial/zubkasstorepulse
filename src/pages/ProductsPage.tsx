import { useMemo, useState } from 'react'
import {
  Package, Plus, Search, Pencil, Trash2, RefreshCw, AlertTriangle,
  Boxes, DollarSign, X,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import AddProductModal from '@/components/AddProductModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingSkeleton, EmptyState } from '@/components/LoadingStates'
import { useWoo } from '@/auth/WooContext'
import {
  createProduct, updateProduct, deleteProduct, updateProductField,
  type CreateProductInput,
} from '@/lib/woocommerce'
import {
  createStandaloneProduct, updateStandaloneProduct, deleteStandaloneProduct,
  updateStandaloneProductStock,
} from '@/lib/standaloneDb'
import { formatCurrency, type Product } from '@/data/mockData'

export default function ProductsPage() {
  const { products, loading, isLive, connection, refresh, addProduct, updateProduct: updateProductState, removeProduct, pushToast, appMode } = useWoo()
  const isStandalone = appMode === 'standalone' || !connection

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingStock, setEditingStock] = useState<string | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [priceValue, setPriceValue] = useState('')

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category))
    return ['All', ...Array.from(cats)]
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesQuery =
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase())
      const matchesCat = category === 'All' || p.category === category
      return matchesQuery && matchesCat
    })
  }, [products, query, category])

  const totalProducts = products.length
  const lowStock = products.filter((p) => p.stock <= 10).length
  const outOfStock = products.filter((p) => p.stock <= 0).length
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)

  const handleAdd = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditTarget(product)
    setModalOpen(true)
  }

  const handleSave = async (data: Omit<Product, 'id' | 'unitsSold'>, id?: string) => {
    if (isStandalone) {
      const input = {
        name: data.name,
        sku: data.sku,
        category: data.category,
        regularPrice: data.price,
        salePrice: data.salePrice,
        stockQuantity: data.stock,
        imageUrl: data.imageUrl,
        description: data.description,
      }
      try {
        if (id) {
          const updated = await updateStandaloneProduct(id, input)
          updateProductState(id, updated)
          pushToast('success', `Product "${updated.name}" updated successfully.`)
        } else {
          const created = await createStandaloneProduct(input)
          addProduct(created)
          pushToast('success', `Product "${created.name}" created successfully.`)
        }
      } catch (err) {
        pushToast('error', `Failed to save product: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } else if (connection) {
      const input: CreateProductInput = {
        name: data.name,
        sku: data.sku,
        category: data.category,
        price: data.price,
        salePrice: data.salePrice,
        stock: data.stock,
        manageStock: data.manageStock,
        stockStatus: data.stockStatus,
        imageUrl: data.imageUrl,
        description: data.description,
        type: data.type,
        virtual: data.virtual,
        downloadable: data.downloadable,
        backorders: data.backorders,
        taxStatus: data.taxStatus,
        taxClass: data.taxClass,
        saleStartDate: data.saleStartDate,
        saleEndDate: data.saleEndDate,
        downloads: data.downloads,
        downloadLimit: data.downloadLimit,
        downloadExpiry: data.downloadExpiry,
        attributes: data.attributes,
        variations: data.variations,
        tags: data.tags,
        fullDescription: data.fullDescription,
      }
      try {
        if (id) {
          const updated = await updateProduct(connection, id, input)
          updateProductState(id, updated)
          pushToast('success', `Product "${updated.name}" updated and synced to store.`)
        } else {
          const created = await createProduct(connection, input)
          addProduct(created)
          pushToast('success', `Product "${created.name}" created and synced to store.`)
        }
      } catch (err) {
        pushToast('error', `Failed to save product: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    setModalOpen(false)
    setEditTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (isStandalone) {
        await deleteStandaloneProduct(deleteTarget.id)
      } else if (connection) {
        await deleteProduct(connection, deleteTarget.id)
      }
      removeProduct(deleteTarget.id)
      pushToast('success', `Product "${deleteTarget.name}" deleted.`)
      setDeleteTarget(null)
    } catch (err) {
      pushToast('error', `Failed to delete product: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleStockSave = async (product: Product) => {
    const newStock = Number(stockValue)
    if (isNaN(newStock) || newStock < 0) {
      pushToast('error', 'Enter a valid stock quantity.')
      return
    }
    setEditingStock(null)
    if (isStandalone) {
      try {
        const updated = await updateStandaloneProductStock(product.id, newStock)
        updateProductState(product.id, updated)
        pushToast('success', `Stock updated for "${product.name}".`)
      } catch (err) {
        pushToast('error', `Failed to update stock: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } else if (connection) {
      try {
        const updated = await updateProductField(connection, product.id, 'stock_quantity', newStock)
        updateProductState(product.id, updated)
        pushToast('success', `Stock updated for "${product.name}".`)
      } catch (err) {
        pushToast('error', `Failed to update stock: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  const handlePriceSave = async (product: Product) => {
    const newPrice = Number(priceValue)
    if (isNaN(newPrice) || newPrice < 0) {
      pushToast('error', 'Enter a valid price.')
      return
    }
    setEditingPrice(null)
    if (isStandalone) {
      try {
        const updated = await updateStandaloneProduct(product.id, { regularPrice: newPrice })
        updateProductState(product.id, updated)
        pushToast('success', `Price updated for "${product.name}".`)
      } catch (err) {
        pushToast('error', `Failed to update price: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    } else if (connection) {
      try {
        const updated = await updateProductField(connection, product.id, 'regular_price', newPrice)
        updateProductState(product.id, updated)
        pushToast('success', `Price updated for "${product.name}".`)
      } catch (err) {
        pushToast('error', `Failed to update price: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-brand">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Products</h1>
              <p className="text-sm text-slate-500">Manage your product catalog, pricing, and inventory.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync
            </button>
            <button onClick={handleAdd} className="btn-primary">
              <Plus className="h-4 w-4" /> Add Product
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total Products" value={totalProducts.toString()} icon={Package} accent="brand" />
          <SummaryCard label="Low Stock" value={lowStock.toString()} icon={AlertTriangle} accent="amber" />
          <SummaryCard label="Out of Stock" value={outOfStock.toString()} icon={Boxes} accent="red" />
          <SummaryCard label="Inventory Value" value={formatCurrency(totalValue)} icon={DollarSign} accent="green" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or SKU…"
              className="input-field pl-10"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    category === c
                      ? 'bg-brand text-white shadow-brand'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {loading && products.length === 0 ? (
            <LoadingSkeleton count={6} />
          ) : filtered.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">Product</th>
                      <th className="pb-3 pr-4">SKU</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4 text-right">Price</th>
                      <th className="pb-3 pr-4 text-right">Stock</th>
                      <th className="pb-3 pr-4 text-center">Sold</th>
                      <th className="pb-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((p) => {
                      const isEditingStock = editingStock === p.id
                      const isEditingPrice = editingPrice === p.id
                      const lowStockBadge = p.stock <= 0 ? 'Out of stock' : p.stock <= 10 ? `${p.stock} left` : `${p.stock}`
                      const stockColor = p.stock <= 0 ? 'text-red-600' : p.stock <= 10 ? 'text-amber-600' : 'text-slate-600'
                      return (
                        <tr key={p.id} className="transition hover:bg-slate-50/60">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                  />
                                ) : (
                                  <span className="text-lg">{p.image}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">{p.name}</p>
                                {p.salePrice !== null && p.salePrice < p.price && (
                                  <span className="text-xs font-medium text-green-600">On Sale</span>
                                )}
                                {p.type === 'variable' && (
                                  <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Variable</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-slate-500">{p.sku}</td>
                          <td className="py-3.5 pr-4 text-slate-600">{p.category}</td>
                          <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {isEditingPrice ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={priceValue}
                                  onChange={(e) => setPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePriceSave(p)
                                    if (e.key === 'Escape') setEditingPrice(null)
                                  }}
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handlePriceSave(p)}
                                  className="rounded p-1 text-green-600 hover:bg-green-50"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingPrice(null)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingPrice(p.id); setPriceValue(String(p.price)) }}
                                className="group flex items-center justify-end gap-1"
                              >
                                <span className="font-semibold text-slate-900">{formatCurrency(p.salePrice ?? p.price)}</span>
                                {p.salePrice !== null && p.salePrice < p.price && (
                                  <span className="text-xs text-slate-400 line-through">{formatCurrency(p.price)}</span>
                                )}
                                <Pencil className="h-3 w-3 text-slate-300 opacity-0 transition group-hover:opacity-100" />
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {isEditingStock ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={stockValue}
                                  onChange={(e) => setStockValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleStockSave(p)
                                    if (e.key === 'Escape') setEditingStock(null)
                                  }}
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleStockSave(p)}
                                  className="rounded p-1 text-green-600 hover:bg-green-50"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingStock(null)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingStock(p.id); setStockValue(String(p.stock)) }}
                                className={`group flex items-center justify-end gap-1 font-medium ${stockColor}`}
                              >
                                {lowStockBadge}
                                <Pencil className="h-3 w-3 text-slate-300 opacity-0 transition group-hover:opacity-100" />
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-center text-slate-500">{p.unitsSold}</td>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(p)}
                                aria-label="Edit product"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(p)}
                                aria-label="Delete product"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="space-y-3 md:hidden">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-100 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <span className="text-xl">{p.image}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{p.name}</p>
                        <p className="truncate text-xs text-slate-400">{p.sku} · {p.category}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          aria-label="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          aria-label="Delete"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-slate-900">{formatCurrency(p.salePrice ?? p.price)}</span>
                        {p.salePrice !== null && p.salePrice < p.price && (
                          <span className="ml-1.5 text-xs text-slate-400 line-through">{formatCurrency(p.price)}</span>
                        )}
                      </div>
                      <span className={`font-medium ${p.stock <= 0 ? 'text-red-600' : p.stock <= 10 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {p.stock} in stock
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title="No products found"
              message={isLive ? 'No products match your search. Try a different filter or add a new product.' : 'Add your first product to start building your catalog.'}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>

      <AddProductModal
        open={modalOpen}
        mode={editTarget ? 'edit' : 'create'}
        product={editTarget}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete product?"
        message={`"${deleteTarget?.name ?? ''}" will be permanently removed from your store. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AppLayout>
  )
}

/* ---------------- Summary Card ---------------- */

function SummaryCard({
  label, value, icon: Icon, accent,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'brand' | 'green' | 'amber' | 'red'
}) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
