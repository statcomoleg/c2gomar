import { getSupabase } from '../client';

export type OffsetBase = 'join' | 'marathon_start';

export interface MarathonMessage {
  id: number;
  step_order: number;
  text: string;
  media_type: string | null;
  media_file_id: string | null;
  button_text: string | null;
  button_url: string | null;
  offset_base: OffsetBase;
  offset_seconds: number;
  min_points: number | null;
  max_points: number | null;
  is_active: boolean;
  created_at: string;
}

export interface QueueEntry {
  id: number;
  user_id: number;
  message_id: number;
  scheduled_at: string;
  sent_at: string | null;
}

export interface PendingEntry extends QueueEntry {
  message: MarathonMessage;
  user_total_points: number;
  user_ref_code: string | null;
  user_marathon_starts_at: string | null;
}

const MSG_COLS =
  'id, step_order, text, media_type, media_file_id, button_text, button_url, offset_base, offset_seconds, min_points, max_points, is_active, created_at';

export async function listMessages(): Promise<MarathonMessage[]> {
  const { data, error } = await getSupabase()
    .from('marathon_messages')
    .select(MSG_COLS)
    .eq('is_active', true)
    .order('step_order');
  if (error) throw error;
  return (data ?? []) as MarathonMessage[];
}

export async function setMediaFileId(id: number, fileId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('marathon_messages')
    .update({ media_file_id: fileId })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Создаёт записи в user_marathon_queue для нового участника.
 * joinedAt — время вступления в канал (UTC ISO string).
 * marathonStartsAt — время старта марафона (UTC ISO string).
 */
export async function enqueueForUser(
  userId: number,
  joinedAt: string,
  marathonStartsAt: string,
): Promise<void> {
  const messages = await listMessages();
  if (messages.length === 0) return;

  const joinedMs = new Date(joinedAt).getTime();
  const marathonMs = new Date(marathonStartsAt).getTime();

  const rows = messages.map((msg) => {
    const baseMs = msg.offset_base === 'join' ? joinedMs : marathonMs;
    const scheduledAt = new Date(baseMs + msg.offset_seconds * 1000).toISOString();
    return {
      user_id: userId,
      message_id: msg.id,
      scheduled_at: scheduledAt,
    };
  });

  // upsert — не дублируем, если уже есть
  const { error } = await getSupabase()
    .from('user_marathon_queue')
    .upsert(rows, { onConflict: 'user_id,message_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Возвращает до batchSize записей, чьё scheduled_at ≤ now и ещё не отправлены */
export async function fetchDue(batchSize = 50): Promise<PendingEntry[]> {
  const now = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('user_marathon_queue')
    .select(
      `id, user_id, message_id, scheduled_at, sent_at,
       message:marathon_messages!inner(${MSG_COLS}),
       user:users!inner(total_points, ref_code, marathon_starts_at)`,
    )
    .is('sent_at', null)
    .lte('scheduled_at', now)
    .order('scheduled_at')
    .limit(batchSize);

  if (error) throw error;

  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const user = r['user'] as Record<string, unknown>;
    return {
      id: r['id'] as number,
      user_id: r['user_id'] as number,
      message_id: r['message_id'] as number,
      scheduled_at: r['scheduled_at'] as string,
      sent_at: r['sent_at'] as string | null,
      message: r['message'] as MarathonMessage,
      user_total_points: (user['total_points'] as number) ?? 0,
      user_ref_code: (user['ref_code'] as string | null) ?? null,
      user_marathon_starts_at: (user['marathon_starts_at'] as string | null) ?? null,
    };
  });
}

export async function markSent(queueId: number): Promise<void> {
  const { error } = await getSupabase()
    .from('user_marathon_queue')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', queueId);
  if (error) throw error;
}
