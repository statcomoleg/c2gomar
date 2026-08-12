import { getSupabase } from '../client';
import type { Submission, SubmissionStatus } from '../../types';

const COLS =
  'id, task_id, user_id, comment_message_id, comment_text, status, points_awarded, reviewed_by, reviewed_at, admin_feedback, submitted_at';

export async function createSubmission(input: {
  task_id: number;
  user_id: number;
  comment_message_id: number;
  comment_text: string;
}): Promise<Submission> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .insert({
      task_id: input.task_id,
      user_id: input.user_id,
      comment_message_id: input.comment_message_id,
      comment_text: input.comment_text,
      status: 'pending',
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Submission;
}

export async function getSubmissionById(id: number): Promise<Submission | null> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Submission | null;
}

export async function findLatestForUserTask(
  userId: number,
  taskId: number,
): Promise<Submission | null> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .select(COLS)
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Submission | null;
}

export async function findActiveForUserTask(
  userId: number,
  taskId: number,
): Promise<Submission | null> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .select(COLS)
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .in('status', ['pending', 'approved'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Submission | null;
}

export async function markSuperseded(id: number): Promise<void> {
  const { error } = await getSupabase()
    .from('submissions')
    .update({ status: 'superseded' })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw error;
}

export async function reviewSubmission(input: {
  id: number;
  status: Extract<SubmissionStatus, 'approved' | 'rejected'>;
  points_awarded?: number | null;
  reviewed_by?: number | null;
  admin_feedback?: string | null;
}): Promise<Submission | null> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .update({
      status: input.status,
      points_awarded: input.points_awarded ?? null,
      reviewed_by: input.reviewed_by ?? null,
      reviewed_at: new Date().toISOString(),
      admin_feedback: input.admin_feedback ?? null,
    })
    .eq('id', input.id)
    .eq('status', 'pending')
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return data as Submission | null;
}

export async function listLatestByUser(userId: number): Promise<Submission[]> {
  const { data, error } = await getSupabase()
    .from('submissions')
    .select(COLS)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}
