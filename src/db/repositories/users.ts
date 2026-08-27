import { getSupabase } from '../client';
import type { User } from '../../types';

const COLS =
  'id, username, first_name, joined_channel_at, total_points, last_points_at, onboarding_step, created_at, ref_code, marathon_starts_at';

export async function findUserById(id: number): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as User | null;
}

export async function createUser(input: {
  id: number;
  username?: string | null;
  first_name?: string | null;
}): Promise<User> {
  const { data, error } = await getSupabase()
    .from('users')
    .insert({
      id: input.id,
      username: input.username ?? null,
      first_name: input.first_name ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as User;
}

export async function upsertUserProfile(input: {
  id: number;
  username?: string | null;
  first_name?: string | null;
}): Promise<User> {
  const existing = await findUserById(input.id);
  if (!existing) {
    return createUser(input);
  }
  const { data, error } = await getSupabase()
    .from('users')
    .update({
      username: input.username ?? existing.username,
      first_name: input.first_name ?? existing.first_name,
    })
    .eq('id', input.id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as User;
}

export async function setOnboardingStep(userId: number, step: number): Promise<void> {
  const { error } = await getSupabase()
    .from('users')
    .update({ onboarding_step: step })
    .eq('id', userId);
  if (error) throw error;
}

export async function markJoinedChannel(userId: number): Promise<User> {
  // marathon_starts_at = послезавтра в 10:00 МСК (Europe/Moscow = UTC+3)
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  msk.setDate(msk.getDate() + 2);
  msk.setHours(10, 0, 0, 0);
  // Обратно в UTC: MSK = UTC+3 → вычитаем 3 часа
  const marathonStartsAt = new Date(msk.getTime() - 3 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from('users')
    .update({
      joined_channel_at: now.toISOString(),
      marathon_starts_at: marathonStartsAt,
    })
    .eq('id', userId)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as User;
}

export async function setRefCode(userId: number, refCode: string): Promise<void> {
  const { error } = await getSupabase()
    .from('users')
    .update({ ref_code: refCode })
    .eq('id', userId)
    .is('ref_code', null); // только если ещё не установлен (первый реф побеждает)
  if (error) throw error;
}

export async function updatePointsCache(
  userId: number,
  totalPoints: number,
  lastPointsAt: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('users')
    .update({ total_points: totalPoints, last_points_at: lastPointsAt })
    .eq('id', userId);
  if (error) throw error;
}

export async function listAllUserIds(): Promise<number[]> {
  const { data, error } = await getSupabase().from('users').select('id');
  if (error) throw error;
  return (data ?? []).map((r) => r.id as number);
}

export async function listUserIdsByPoints(
  op: 'gt' | 'lt',
  threshold: number,
): Promise<number[]> {
  let q = getSupabase().from('users').select('id');
  q = op === 'gt' ? q.gt('total_points', threshold) : q.lt('total_points', threshold);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.id as number);
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const clean = username.replace(/^@/, '').toLowerCase();
  const { data, error } = await getSupabase()
    .from('users')
    .select(COLS)
    .ilike('username', clean)
    .maybeSingle();
  if (error) throw error;
  return data as User | null;
}
