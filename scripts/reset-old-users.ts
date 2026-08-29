/**
 * Сброс данных старого потока для всех пользователей.
 * Участники остаются в БД, но могут пройти автомарафон заново.
 *
 * Запуск: npx tsx scripts/reset-old-users.ts
 * Dry-run: npx tsx scripts/reset-old-users.ts --dry-run
 */
import 'dotenv/config';
import { getSupabase } from '../src/db/client';

const dryRun = process.argv.includes('--dry-run');

async function count(table: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const sb = getSupabase();

  const before = {
    users: await count('users'),
    submissions: await count('submissions'),
    ledger: await count('points_ledger'),
    queue: await count('user_marathon_queue'),
    promoUses: await count('promo_code_uses').catch(() => 0),
  };

  console.log('Текущее состояние:');
  console.log(`  users:              ${before.users}`);
  console.log(`  submissions:        ${before.submissions}`);
  console.log(`  points_ledger:      ${before.ledger}`);
  console.log(`  user_marathon_queue:${before.queue}`);
  console.log(`  promo_code_uses:    ${before.promoUses}`);

  if (dryRun) {
    console.log('\n[dry-run] Изменения не применялись.');
    return;
  }

  console.log('\nСбрасываем...');

  const steps: Array<{ label: string; run: () => Promise<unknown> }> = [
    {
      label: 'points_ledger',
      run: () => sb.from('points_ledger').delete().gte('id', 0),
    },
    {
      label: 'submissions',
      run: () => sb.from('submissions').delete().gte('id', 0),
    },
    {
      label: 'promo_code_uses',
      run: () => sb.from('promo_code_uses').delete().gte('user_id', 0),
    },
    {
      label: 'user_marathon_queue',
      run: () => sb.from('user_marathon_queue').delete().gte('id', 0),
    },
    {
      label: 'users (reset progress)',
      run: () =>
        sb
          .from('users')
          .update({
            total_points: 0,
            last_points_at: null,
            joined_channel_at: null,
            marathon_starts_at: null,
            onboarding_step: 0,
          })
          .gte('id', 0),
    },
  ];

  for (const step of steps) {
    const { error } = await step.run();
    if (error) {
      console.error(`❌ ${step.label}: ${error.message}`);
      if (step.label === 'promo_code_uses' || step.label === 'user_marathon_queue') {
        console.warn(`   (пропускаем — таблица может отсутствовать)`);
        continue;
      }
      throw error;
    }
    console.log(`✅ ${step.label}`);
  }

  const after = {
    submissions: await count('submissions'),
    ledger: await count('points_ledger'),
    queue: await count('user_marathon_queue').catch(() => 0),
  };

  console.log('\nГотово. После сброса:');
  console.log(`  submissions:        ${after.submissions}`);
  console.log(`  points_ledger:      ${after.ledger}`);
  console.log(`  user_marathon_queue:${after.queue}`);
  console.log('\nПользователи могут снова нажать /start и пройти автомарафон с нуля.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
