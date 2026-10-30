import { Plus, Trash2 } from 'lucide-react'
import type { ProductDraft } from '@/components/ProductFormTabs'

type DownloadableFilesEditorProps = {
  downloads: ProductDraft['downloads']
  onChange: (downloads: ProductDraft['downloads']) => void
}

export default function DownloadableFilesEditor({ downloads, onChange }: DownloadableFilesEditorProps) {
  const patch = (index: number, change: Partial<ProductDraft['downloads'][number]>) =>
    onChange(downloads.map((d, i) => (i === index ? { ...d, ...change } : d)))

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Downloadable files</p>
        <p className="mt-0.5 text-xs text-slate-400">Customers receive these files after purchase. Use a public https link.</p>
      </div>
      {downloads.length === 0 && <p className="text-sm text-slate-400">No files added yet.</p>}
      {downloads.map((file, i) => (
        <div key={file.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">File name</span>
            <input
              value={file.name}
              onChange={(e) => patch(i, { name: e.target.value })}
              className="input-field"
              placeholder="e.g. User guide"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">File URL</span>
            <input
              type="url"
              value={file.file}
              onChange={(e) => patch(i, { file: e.target.value })}
              className="input-field"
              placeholder="https://..."
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(downloads.filter((_, j) => j !== i))}
            aria-label="Remove file"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...downloads, { id: crypto.randomUUID(), name: '', file: '' }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" /> Add File
      </button>
    </div>
  )
}
