import { getSupabase } from '../client';
import type { Task, TaskType } from '../../types';

const COLS =
  'id, type, label, description, channel_post_link, channel_message_id, discussion_message_id, is_active, created_by, created_at';

export async function listActiveTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(COLS)
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('label', { ascending: true });
  if (error) throw error;
  // pre before main: 'main' < 'pre' alphabetically — sort manually
  const tasks = (data ?? []) as Task[];
  return tasks.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'pre' ? -1 : 1;
    return a.label.localeCompare(b.label, 'ru');
  });
}

export async function getTaskById(id: number): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function findByChannelMessageId(
  channelMessageId: number,
): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(COLS)
    .eq('channel_message_id', channelMessageId)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function findByDiscussionMessageId(
  discussionMessageId: number,
): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(COLS)
    .eq('discussion_message_id', discussionMessageId)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function countByType(type: TaskType): Promise<number> {
  const { count, error } = await getSupabase()
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('type', type);
  if (error) throw error;
  return count ?? 0;
}

export async function createTask(input: {
  type: TaskType;
  label: string;
  description: string;
  channel_post_link: string;
  channel_message_id: number;
  discussion_message_id?: number | null;
  created_by?: number | null;
}): Promise<Task> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .insert({
      type: input.type,
      label: input.label,
      description: input.description,
      channel_post_link: input.channel_post_link,
      channel_message_id: input.channel_message_id,
      discussion_message_id: input.discussion_message_id ?? null,
      created_by: input.created_by ?? null,
      is_active: true,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Task;
}

export async function setDiscussionMessageId(
  taskId: number,
  discussionMessageId: number,
): Promise<void> {
  const { error } = await getSupabase()
    .from('tasks')
    .update({ discussion_message_id: discussionMessageId })
    .eq('id', taskId);
  if (error) throw error;
}

export async function findTaskWithoutDiscussionByChannelMsg(
  channelMessageId: number,
): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(COLS)
    .eq('channel_message_id', channelMessageId)
    .is('discussion_message_id', null)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}
