/**
 * Применяем 0018_marathon_schedule.sql через pg напрямую в Supabase Postgres.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!; // https://xxx.supabase.co
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!;
const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const connectionString = `postgresql://postgres:${DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`;

const sql = readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/0018_marathon_schedule.sql'),
  'utf8',
);

async function main() {
  const { default: pg } = await import('pg') as unknown as { default: typeof import('pg') };
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration 0018 applied ✅');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
