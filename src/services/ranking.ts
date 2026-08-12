import { getSupabase } from '../db/client';
import type { RankedUser } from '../types';

export async function getTop10(): Promise<RankedUser[]> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id, username, first_name, total_points, last_points_at')
    .order('total_points', { ascending: false })
    .order('last_points_at', { ascending: true, nullsFirst: false })
    .limit(10);
  if (error) throw error;

  return (data ?? []).map((u, i) => ({
    id: u.id as number,
    username: u.username as string | null,
    first_name: u.first_name as string | null,
    total_points: u.total_points as number,
    rank: i + 1,
  }));
}

export async function getUserRank(userId: number): Promise<{
  rank: number;
  total_points: number;
}> {
  // Полное ранжирование через SQL (row_number)
  const { data, error } = await getSupabase().rpc('get_user_rank', {
    p_user_id: userId,
  });

  if (!error && data && Array.isArray(data) && data.length > 0) {
    return {
      rank: Number(data[0].rank),
      total_points: Number(data[0].total_points),
    };
  }

  // Fallback без RPC: загружаем всех и считаем в памяти (ок для ~1000)
  const { data: users, error: e2 } = await getSupabase()
    .from('users')
    .select('id, total_points, last_points_at')
    .order('total_points', { ascending: false })
    .order('last_points_at', { ascending: true, nullsFirst: false });
  if (e2) throw e2;

  const list = users ?? [];
  const idx = list.findIndex((u) => u.id === userId);
  const me = list.find((u) => u.id === userId);
  return {
    rank: idx >= 0 ? idx + 1 : list.length + 1,
    total_points: (me?.total_points as number) ?? 0,
  };
}
