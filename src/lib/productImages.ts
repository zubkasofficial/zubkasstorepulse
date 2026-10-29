import { getSupabase, PRODUCT_IMAGE_BUCKET } from '@/lib/supabase'
import { normalizeStoreUrl, type WooConnection } from '@/lib/woocommerce'

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

export type ImageUploadTarget =
  | { mode: 'standalone' }
  | { mode: 'woo'; connection: WooConnection | null }

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

async function uploadToSupabase(blob: Blob, source: File | string): Promise<{ url: string; uploaded: boolean }> {
  const supabase = getSupabase()
  const path = `product/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt(blob.type)}`

  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  })

  if (error) {
    const url = typeof source === 'string' ? source : await fileToDataUrl(source)
    return { url, uploaded: false }
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, uploaded: true }
}

async function uploadToWordPress(blob: Blob, connection: WooConnection | null): Promise<string> {
  if (!connection) throw new Error('Connect your WooCommerce store in Settings before uploading photos.')
  if (!connection.wpUsername.trim() || !connection.wpAppPassword.trim()) {
    throw new Error('Add your WordPress username and application password in Settings to upload photos.')
  }

  const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt(blob.type)}`
  const auth = btoa(`${connection.wpUsername.trim()}:${connection.wpAppPassword.trim()}`)

  let res: Response
  try {
    res = await fetch(`${normalizeStoreUrl(connection.storeUrl)}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': blob.type,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: blob,
    })
  } catch {
    throw new Error('Could not reach your WordPress site to upload the photo. Check the store URL in Settings.')
  }

  const body = (await res.json().catch(() => null)) as { message?: unknown; source_url?: unknown } | null
  if (!res.ok) {
    const detail = typeof body?.message === 'string' ? body.message : 'check the username and application password'
    throw new Error(`WordPress rejected the photo (${res.status}): ${detail}`)
  }
  if (typeof body?.source_url !== 'string' || !/^https?:\/\//i.test(body.source_url)) {
    throw new Error('WordPress did not return a link to the uploaded photo.')
  }
  return body.source_url
}

/**
 * Uploads a product image to the storage that matches the operational mode:
 * Supabase Storage in Standalone mode, the WordPress media library in WooCommerce mode.
 * Standalone mode may keep a local data URL as a fallback because it stores images in the database.
 */
export async function uploadProductImage(
  source: File | string,
  target: ImageUploadTarget,
): Promise<{ url: string; uploaded: boolean }> {
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source
  if (!VALID_TYPES.includes(blob.type)) throw new Error('Unsupported image type. Use PNG, JPG, or WEBP.')
  if (blob.size > MAX_BYTES) throw new Error('Image must be under 8 MB.')

  if (target.mode === 'woo') {
    return { url: await uploadToWordPress(blob, target.connection), uploaded: true }
  }
  return uploadToSupabase(blob, source)
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read the image file.'))
    reader.readAsDataURL(file)
  })
}
