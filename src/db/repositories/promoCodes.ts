import { getSupabase } from '../client';

export interface PromoCode {
  id: number;
  code: string;
  points: number;
  is_active: boolean;
  max_uses: number;
  used_count: number;
  created_at: string;
}

const COLS = 'id, code, points, is_active, max_uses, used_count, created_at';

/** Найти активный код (точное совпадение) и проверить лимит использований */
export async function findRedeemable(code: string): Promise<PromoCode | null> {
  const { data, error } = await getSupabase()
    .from('promo_codes')
    .select(COLS)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // max_uses = 0 → безлимит
  if (data.max_uses > 0 && data.used_count >= data.max_uses) return null;
  return data as PromoCode;
}

/** Записать использование. Возвращает false, если пользователь уже использовал этот код */
export async function redeemCode(codeId: number, userId: number): Promise<boolean> {
  const { error } = await getSupabase()
    .from('promo_code_uses')
    .insert({ code_id: codeId, user_id: userId });
  if (error) {
    // unique violation → уже использовал
    if (String(error.code) === '23505') return false;
    throw error;
  }
  await getSupabase().rpc('increment_promo_used', { p_id: codeId });
  return true;
}

/** Безопасное увеличение счётчика через update (если rpc не настроено) */
export async function incrementUsedCount(codeId: number): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb
    .from('promo_codes')
    .select('used_count')
    .eq('id', codeId)
    .single();
  if (!data) return;
  await sb
    .from('promo_codes')
    .update({ used_count: data.used_count + 1 })
    .eq('id', codeId);
}

export async function listCodes(): Promise<PromoCode[]> {
  const { data, error } = await getSupabase()
    .from('promo_codes')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromoCode[];
}

export async function createCode(
  code: string,
  points: number,
  maxUses = 0,
): Promise<PromoCode> {
  const { data, error } = await getSupabase()
    .from('promo_codes')
    .insert({ code, points, max_uses: maxUses })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as PromoCode;
}

export async function updateCode(
  id: number,
  patch: Partial<Pick<PromoCode, 'is_active' | 'points' | 'max_uses'>>,
): Promise<PromoCode> {
  const { data, error } = await getSupabase()
    .from('promo_codes')
    .update(patch)
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as PromoCode;
}

export async function deleteCode(id: number): Promise<void> {
  const { error } = await getSupabase().from('promo_codes').delete().eq('id', id);
  if (error) throw error;
}
