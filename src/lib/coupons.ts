import { getSupabase } from '@/lib/supabase'
import type { Coupon, CouponDiscountType, CreateCouponInput } from '@/lib/woocommerce'

type SupabaseCouponRow = {
  id: string
  code: string
  discount_type: string
  amount: string | number
  minimum_amount: string | number
  usage_limit: number
  usage_count: number
  date_expires: string | null
  free_shipping: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapRow(r: SupabaseCouponRow): Coupon {
  let type: CouponDiscountType = 'percent'
  if (r.discount_type === 'fixed_cart') type = 'fixed_cart'
  else if (r.discount_type === 'fixed_product') type = 'fixed_product'
  else if (r.discount_type === 'percent') type = 'percent'
  return {
    id: r.id,
    code: r.code,
    discountType: type,
    amount: Number(r.amount) || 0,
    minimumSpend: Number(r.minimum_amount) || 0,
    usageLimit: r.usage_limit ?? 0,
    usageCount: r.usage_count ?? 0,
    expiryDate: r.date_expires ?? '',
    freeShipping: !!r.free_shipping,
    isActive: r.is_active ?? true,
  }
}

export async function fetchCouponsFromSupabase(): Promise<Coupon[]> {
  const sb = getSupabase()
  if (!sb) return []
  try {
    const { data, error } = await sb
      .from('coupons')
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, free_shipping, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[coupons] fetch error:', error.message)
      return []
    }
    if (!data) return []
    return (data as SupabaseCouponRow[]).map(mapRow)
  } catch (err) {
    console.error('[coupons] fetch exception:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function insertCouponToSupabase(input: CreateCouponInput): Promise<Coupon | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const row = {
      code: input.code,
      discount_type: input.discountType,
      amount: input.amount,
      minimum_amount: input.minimumSpend,
      usage_limit: input.usageLimit,
      usage_count: 0,
      date_expires: input.expiryDate || null,
      free_shipping: input.freeShipping,
      is_active: true,
    }
    const { data, error } = await sb
      .from('coupons')
      .upsert(row, { onConflict: 'code' })
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, free_shipping, is_active, created_at, updated_at')
      .single()
    if (error) {
      console.error('[coupons] insert error:', error.message)
      return null
    }
    if (!data) return null
    return mapRow(data as SupabaseCouponRow)
  } catch (err) {
    console.error('[coupons] insert exception:', err instanceof Error ? err.message : err)
    return null
  }
}

export async function deleteCouponFromSupabase(code: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const { error } = await sb.from('coupons').delete().eq('code', code)
    if (error) console.error('[coupons] delete error:', error.message)
    return !error
  } catch (err) {
    console.error('[coupons] delete exception:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function toggleCouponActiveInSupabase(code: string, isActive: boolean): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const { error } = await sb.from('coupons').update({ is_active: isActive }).eq('code', code)
    if (error) console.error('[coupons] toggle active error:', error.message)
    return !error
  } catch (err) {
    console.error('[coupons] toggle active exception:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function incrementCouponUsage(code: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  try {
    const { data, error } = await sb.from('coupons').select('usage_count').eq('code', code).maybeSingle()
    if (error || !data) return
    await sb.from('coupons').update({ usage_count: (data.usage_count ?? 0) + 1 }).eq('code', code)
  } catch {
    /* non-critical */
  }
}
