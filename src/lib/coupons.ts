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
  }
}

export async function fetchCouponsFromSupabase(): Promise<Coupon[]> {
  const sb = getSupabase()
  if (!sb) return []
  try {
    const { data, error } = await sb
      .from('coupons')
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, free_shipping, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return (data as SupabaseCouponRow[]).map(mapRow)
  } catch {
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
    }
    const { data, error } = await sb
      .from('coupons')
      .insert(row)
      .select('id, code, discount_type, amount, minimum_amount, usage_limit, usage_count, date_expires, free_shipping, created_at, updated_at')
      .single()
    if (error || !data) return null
    return mapRow(data as SupabaseCouponRow)
  } catch {
    return null
  }
}

export async function deleteCouponFromSupabase(code: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const { error } = await sb.from('coupons').delete().eq('code', code)
    return !error
  } catch {
    return false
  }
}

export async function incrementCouponUsage(code: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  try {
    const { data } = await sb.from('coupons').select('usage_count').eq('code', code).single()
    if (data) {
      await sb.from('coupons').update({ usage_count: (data.usage_count ?? 0) + 1 }).eq('code', code)
    }
  } catch {
    /* non-critical */
  }
}
