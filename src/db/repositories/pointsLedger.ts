import { getSupabase } from '../client';
import type { PointsLedgerEntry, PointsReason } from '../../types';
import * as usersRepo from './users';

const COLS =
  'id, user_id, points, reason, related_submission_id, related_task_id, admin_id, created_at';

/**
 * Единственная точка начисления баллов.
 * Пишет в points_ledger и обновляет кэш users.total_points / last_points_at.
 */
export async function award(input: {
  userId: number;
  points: number;
  reason: PointsReason;
  relatedSubmissionId?: number | null;
  relatedTaskId?: number | null;
  adminId?: number | null;
}): Promise<{ entry: PointsLedgerEntry; newTotal: number }> {
  const user = await usersRepo.findUserById(input.userId);
  if (!user) throw new Error(`User ${input.userId} not found`);

  const { data, error } = await getSupabase()
    .from('points_ledger')
    .insert({
      user_id: input.userId,
      points: input.points,
      reason: input.reason,
      related_submission_id: input.relatedSubmissionId ?? null,
      related_task_id: input.relatedTaskId ?? null,
      admin_id: input.adminId ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;

  const now = new Date().toISOString();
  const newTotal = user.total_points + input.points;
  await usersRepo.updatePointsCache(input.userId, newTotal, now);

  return { entry: data as PointsLedgerEntry, newTotal };
}
