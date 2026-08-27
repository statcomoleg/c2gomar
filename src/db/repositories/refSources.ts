import { getSupabase } from '../client';

export interface RefSource {
  code: string;
  label: string;
  target_url: string;
  clicks: number;
  joins: number;
  created_at: string;
}

const COLS = 'code, label, target_url, clicks, joins, created_at';

export async function listRefSources(): Promise<RefSource[]> {
  const { data, error } = await getSupabase()
    .from('ref_sources')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RefSource[];
}

export async function findByCode(code: string): Promise<RefSource | null> {
  const { data, error } = await getSupabase()
    .from('ref_sources')
    .select(COLS)
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data as RefSource | null;
}

export async function createRefSource(input: {
  code: string;
  label: string;
  target_url: string;
}): Promise<RefSource> {
  const { data, error } = await getSupabase()
    .from('ref_sources')
    .insert(input)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as RefSource;
}

export async function updateRefSource(
  code: string,
  patch: Partial<Pick<RefSource, 'label' | 'target_url'>>,
): Promise<RefSource> {
  const { data, error } = await getSupabase()
    .from('ref_sources')
    .update(patch)
    .eq('code', code)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as RefSource;
}

export async function deleteRefSource(code: string): Promise<void> {
  const { error } = await getSupabase().from('ref_sources').delete().eq('code', code);
  if (error) throw error;
}

export async function incrementClicks(code: string): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb.from('ref_sources').select('clicks').eq('code', code).single();
  if (!data) return;
  await sb.from('ref_sources').update({ clicks: (data.clicks as number) + 1 }).eq('code', code);
}

export async function incrementJoins(code: string): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb.from('ref_sources').select('joins').eq('code', code).single();
  if (!data) return;
  await sb.from('ref_sources').update({ joins: (data.joins as number) + 1 }).eq('code', code);
}

/** Получить URL для подстановки по ref_code пользователя (или дефолтный) */
export async function resolveRefUrl(
  refCode: string | null | undefined,
  defaultUrl: string,
): Promise<string> {
  if (!refCode) return defaultUrl;
  const src = await findByCode(refCode);
  return src?.target_url ?? defaultUrl;
}
