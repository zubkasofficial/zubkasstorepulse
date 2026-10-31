import { useState } from 'react'
import { Plus, Trash2, Upload, Loader as Loader2 } from 'lucide-react'
import type { ProductDraft } from '@/components/ProductFormTabs'

type DownloadableFilesEditorProps = {
  downloads: ProductDraft['downloads']
  onChange: (downloads: ProductDraft['downloads']) => void
  onUploadFile?: (file: File) => Promise<string>
}

export default function DownloadableFilesEditor({ downloads, onChange, onUploadFile }: DownloadableFilesEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const patch = (index: number, change: Partial<ProductDraft['downloads'][number]>) =>
    onChange(downloads.map((d, i) => (i === index ? { ...d, ...change } : d)))

  const handleUpload = async (file: File | undefined) => {
    if (!file || !onUploadFile) return
    setUploadError('')
    setUploading(true)
    try {
      const url = await onUploadFile(file)
      onChange([...downloads, { id: crypto.randomUUID(), name: file.name, file: url }])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'File upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Downloadable files</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Customers receive these files after purchase. Upload a file from your device or paste a public https link.
        </p>
      </div>

      {onUploadFile && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload file</>
            )}
            <input
              type="file"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void handleUpload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

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
        <Plus className="h-4 w-4" /> Add file (URL)
      </button>
    </div>
  )
}
