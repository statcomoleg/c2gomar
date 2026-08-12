import { pointsLedgerRepo } from '../db/repositories';
import type { PointsReason } from '../types';

/** Обёртка: все начисления только через этот сервис */
export async function awardPoints(input: {
  userId: number;
  points: number;
  reason: PointsReason;
  relatedSubmissionId?: number | null;
  relatedTaskId?: number | null;
  adminId?: number | null;
}): Promise<{ newTotal: number }> {
  const { newTotal } = await pointsLedgerRepo.award(input);
  return { newTotal };
}
