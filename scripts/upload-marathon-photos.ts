/**
 * Загружает картинки писем в Telegram и сохраняет file_id в marathon_messages.
 * Запуск: npx tsx scripts/upload-marathon-photos.ts
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { getSupabase } from '../src/db/client';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_IDS!.split(',')[0].trim();

const FOLDER = path.resolve(
  process.cwd(),
  'Новая папка',
);

// Маппинг: часть имени файла (рус) → step_order
const NAME_TO_STEP: Record<string, number> = {
  'первая':    10,
  'вторая':    30,
  'третья':    50,
  'четвертая': 70,
  'пятая':     90,
};

async function sendPhoto(filePath: string): Promise<string> {
  const FormData = (await import('form-data')).default;
  const fetch = (await import('node-fetch')).default;

  const form = new FormData();
  form.append('chat_id', ADMIN_ID);
  form.append('photo', readFileSync(filePath), { filename: path.basename(filePath) });

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    { method: 'POST', body: form },
  );
  const json = await res.json() as {
    ok: boolean;
    result?: { photo?: Array<{ file_id: string }> };
    description?: string;
  };

  if (!json.ok) throw new Error(json.description ?? 'Telegram error');
  const photos = json.result?.photo;
  if (!photos || photos.length === 0) throw new Error('No photo in response');
  return photos[photos.length - 1].file_id; // берём наибольшее разрешение
}

async function main() {
  const sb = getSupabase();

  const files = readdirSync(FOLDER).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f),
  );

  console.log(`Найдено файлов: ${files.length}`);

  for (const file of files) {
    const lower = file.toLowerCase();
    let stepOrder: number | null = null;

    for (const [key, step] of Object.entries(NAME_TO_STEP)) {
      if (lower.includes(key)) {
        stepOrder = step;
        break;
      }
    }

    if (stepOrder === null) {
      console.warn(`⚠️  Не определён step для файла: ${file}`);
      continue;
    }

    const filePath = path.join(FOLDER, file);
    console.log(`\n📤 Загружаю "${file}" → step_order=${stepOrder}...`);

    try {
      const fileId = await sendPhoto(filePath);
      console.log(`   file_id: ${fileId.slice(0, 40)}...`);

      const { error } = await sb
        .from('marathon_messages')
        .update({ media_type: 'photo', media_file_id: fileId })
        .eq('step_order', stepOrder);

      if (error) {
        console.error(`   ❌ DB error: ${error.message}`);
      } else {
        console.log(`   ✅ Сохранено в БД`);
      }
    } catch (err) {
      console.error(`   ❌ Ошибка: ${err}`);
    }
  }

  console.log('\nГотово!');
}

main().catch(e => { console.error(e); process.exit(1); });
