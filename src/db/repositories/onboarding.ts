import { getSupabase } from '../client';
import type { OnboardingMessage } from '../../types';

const COLS =
  'id, step_order, text, delay_seconds, media_type, media_file_id, local_media_paths, button_text, button_url, only_if_not_joined, created_at';

export async function listOnboardingMessages(): Promise<OnboardingMessage[]> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .select(COLS)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OnboardingMessage[];
}

export async function getOnboardingById(id: number): Promise<OnboardingMessage | null> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as OnboardingMessage | null;
}

export async function updateOnboardingText(
  id: number,
  text: string,
): Promise<OnboardingMessage> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .update({ text })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as OnboardingMessage;
}

export async function updateOnboardingDelay(
  id: number,
  delaySeconds: number,
): Promise<OnboardingMessage> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .update({ delay_seconds: delaySeconds })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as OnboardingMessage;
}

export async function setOnboardingMedia(
  id: number,
  mediaType: 'photo' | 'video' | 'video_note' | 'media_group',
  mediaFileId: string,
): Promise<OnboardingMessage> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .update({ media_type: mediaType, media_file_id: mediaFileId })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as OnboardingMessage;
}

export async function findVideoNoteStep(): Promise<OnboardingMessage | null> {
  const { data, error } = await getSupabase()
    .from('onboarding_messages')
    .select(COLS)
    .eq('media_type', 'video_note')
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as OnboardingMessage | null;
}
