import 'dotenv/config';
import { getSupabase } from '../src/db/client';

async function main() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_settings')
    .update({
      channel_id: -1003877739897,
      discussion_group_id: -1004396739025,
    })
    .eq('id', true)
    .select('*')
    .single();
  if (error) throw error;
  console.log('Updated:', data);
}

main().catch(console.error);
