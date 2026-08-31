import 'dotenv/config';
import { getSupabase } from '../src/db/client';

async function main() {
  const sb = getSupabase();

  const { data: settings } = await sb.from('app_settings').select('*').eq('id', true).single();
  console.log('=== app_settings ===');
  console.log(JSON.stringify(settings, null, 2));

  const { data: tasks } = await sb.from('tasks').select('*').order('id');
  console.log('\n=== tasks ===');
  for (const t of tasks ?? []) {
    console.log(
      `id=${t.id} ${t.label} type=${t.type} channel_msg=${t.channel_message_id} discussion_msg=${t.discussion_message_id ?? 'NULL'} active=${t.is_active}`,
    );
    console.log(`  link: ${t.channel_post_link}`);
  }

  const { count: subCount } = await sb
    .from('submissions')
    .select('*', { count: 'exact', head: true });
  const { data: subs } = await sb
    .from('submissions')
    .select('id, user_id, task_id, status, submitted_at, comment_text')
    .order('submitted_at', { ascending: false })
    .limit(10);
  console.log(`\n=== submissions (total ${subCount}) ===`);
  console.log(JSON.stringify(subs, null, 2));

  const now = new Date();
  const startAt = settings?.marathon_start_at ? new Date(settings.marathon_start_at) : null;
  console.log('\n=== time check ===');
  console.log('now:', now.toISOString());
  console.log('marathon_start_at:', startAt?.toISOString());
  console.log('now > marathon_start_at (ПДЗ закрыты?):', startAt ? now > startAt : 'n/a');
}

main().catch(console.error);
