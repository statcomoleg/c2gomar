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
  // marathon_starts_at = послезавтра в 10:00 МСК (UTC+3 = UTC+07:00 по offset)
  const now = new Date();
  // Получаем компоненты даты «послезавтра» в московском времени
  const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const mskStr = dayAfterTomorrow.toLocaleString('en-US', { timeZone: 'Europe/Moscow' });
  const mskDate = new Date(mskStr); // локальные год/месяц/день в MSK
  const year = mskDate.getFullYear();
  const month = mskDate.getMonth();
  const day = mskDate.getDate();
  // 10:00 МСК = 07:00 UTC (MSK = UTC+3, поэтому UTC = 10 - 3 = 7)
  const marathonStartsAt = new Date(Date.UTC(year, month, day, 7, 0, 0)).toISOString();

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
  // До вступления в канал — обновляем ref_code при каждом /start CODE
  // (last-click attribution: последний переход по реф-ссылке до вступления).
  // После вступления ref_code заморожен.
  const { error } = await getSupabase()
    .from('users')
    .update({ ref_code: refCode })
    .eq('id', userId)
    .is('joined_channel_at', null);
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
