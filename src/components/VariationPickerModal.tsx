import { useEffect, useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'
import type { Product, ProductVariation } from '@/data/mockData'
import { formatCurrency } from '@/data/mockData'

type VariationPickerModalProps = {
  product: Product
  onClose: () => void
  onSelect: (variation: ProductVariation, price: number, name: string) => void
}

export default function VariationPickerModal({ product, onClose, onSelect }: VariationPickerModalProps) {
  const variationAttrs = useMemo(() => {
    return product.attributes.filter((a) => a.variation)
  }, [product.attributes])

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const attr of variationAttrs) {
      if (attr.options.length > 0) {
        initial[attr.name] = attr.options[0]
      }
    }
    setSelectedOptions(initial)
  }, [variationAttrs])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const matchedVariation = useMemo(() => {
    if (product.variations.length === 0) return null
    return product.variations.find((v) =>
      v.attributes.every((va) => selectedOptions[va.name] === va.option),
    ) ?? null
  }, [product.variations, selectedOptions])

  const variationPrice = useMemo(() => {
    if (!matchedVariation) return product.salePrice ?? product.price
    const price = Number(matchedVariation.price) || 0
    const sale = matchedVariation.salePrice ? Number(matchedVariation.salePrice) : null
    return sale ?? price
  }, [matchedVariation, product])

  const variationLabel = useMemo(() => {
    const parts = variationAttrs.map((a) => selectedOptions[a.name]).filter(Boolean)
    return parts.length > 0 ? parts.join(' / ') : ''
  }, [variationAttrs, selectedOptions])

  const handleConfirm = () => {
    if (!matchedVariation) return
    const name = variationLabel
      ? `${product.name} (${variationLabel})`
      : product.name
    onSelect(matchedVariation, variationPrice, name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl animate-slide-up sm:rounded-2xl sm:animate-scale-in">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">Choose Variation</h3>
            <p className="text-sm text-slate-500">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {variationAttrs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No variable attributes found for this product.
          </p>
        ) : (
          <div className="space-y-4">
            {variationAttrs.map((attr) => (
              <div key={attr.id}>
                <p className="mb-2 text-sm font-semibold text-slate-700">{attr.name}</p>
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((opt) => {
                    const isSelected = selectedOptions[attr.name] === opt
                    return (
                      <button
                        key={opt}
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [attr.name]: opt }))}
                        className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          isSelected
                            ? 'border-brand bg-brand-50 text-brand'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {matchedVariation && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Variation Price</p>
                <p className="font-display text-xl font-bold text-slate-900">
                  {formatCurrency(variationPrice)}
                </p>
              </div>
              {matchedVariation.sku && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">SKU</p>
                  <p className="text-sm font-medium text-slate-600">{matchedVariation.sku}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!matchedVariation && variationAttrs.length > 0 && (
          <p className="mt-4 text-center text-sm text-amber-600">
            No matching variation for the selected options.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matchedVariation}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
