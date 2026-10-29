import { getSupabase } from '@/lib/supabase'

const BUCKET = 'product-images'
const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/i)
  if (!match) throw new Error('Invalid image data URL.')
  const mime = match[1]
  const base64 = match[2]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

function fileExt(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

/**
 * Uploads a local image (File or Base64 data URL) to Supabase Storage and
 * returns the public https URL. WooCommerce only accepts http(s) image URLs —
 * Base64 data URLs fail with "Error getting remote image. No URL Provided."
 *
 * If Supabase is not configured or the upload fails, the original data URL is
 * returned as a fallback so the image still previews locally and saves in
 * standalone mode (which stores data URLs directly in the products table).
 */
export async function uploadProductImage(
  source: File | string,
  keyPrefix = 'product',
): Promise<{ url: string; uploaded: boolean }> {
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source
  const mime = blob.type
  if (!VALID_TYPES.includes(mime)) throw new Error('Unsupported image type. Use PNG, JPG, or WEBP.')
  if (blob.size > MAX_BYTES) throw new Error('Image must be under 8 MB.')

  let supabase
  try {
    supabase = getSupabase()
  } catch {
    const fallback = typeof source === 'string' ? source : await fileToDataUrl(source)
    return { url: fallback, uploaded: false }
  }

  const ext = fileExt(mime)
  const path = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: false,
  })

  if (error) {
    const fallback = typeof source === 'string' ? source : await fileToDataUrl(source)
    return { url: fallback, uploaded: false }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, uploaded: true }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read the image file.'))
    reader.readAsDataURL(file)
  })
}
