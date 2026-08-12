import { getSupabase } from '../client';
import type { AppSettings } from '../../types';

const COLS =
  'id, marathon_start_at, channel_id, discussion_group_id, channel_invite_link';

export async function getSettings(): Promise<AppSettings | null> {
  const { data, error } = await getSupabase()
    .from('app_settings')
    .select(COLS)
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return data as AppSettings | null;
}

export async function updateSettings(
  patch: Partial<
    Pick<
      AppSettings,
      'marathon_start_at' | 'channel_id' | 'discussion_group_id' | 'channel_invite_link'
    >
  >,
): Promise<AppSettings> {
  const { data, error } = await getSupabase()
    .from('app_settings')
    .update(patch)
    .eq('id', true)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as AppSettings;
}
