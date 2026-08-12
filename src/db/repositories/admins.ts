import { getSupabase } from '../client';
import type { Admin } from '../../types';

const COLS = 'id, added_at';

export async function isAdmin(telegramId: number): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('admins')
    .select('id')
    .eq('id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listAdmins(): Promise<Admin[]> {
  const { data, error } = await getSupabase().from('admins').select(COLS);
  if (error) throw error;
  return (data ?? []) as Admin[];
}

export async function ensureAdminsFromEnv(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = ids.map((id) => ({ id }));
  const { error } = await getSupabase().from('admins').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}
