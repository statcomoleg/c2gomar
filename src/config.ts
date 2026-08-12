import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  TZ: z.string().default('Europe/Moscow'),
});

export type Env = z.infer<typeof envSchema> & {
  adminIds: number[];
};

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Невалидный .env: ${msg}`);
  }

  const adminIds = parsed.data.ADMIN_TELEGRAM_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  return { ...parsed.data, adminIds };
}

/** Парсинг ссылки на пост канала → channel_message_id */
export function parseChannelPostLink(link: string): {
  channelMessageId: number;
  normalizedLink: string;
} | null {
  const trimmed = link.trim();
  // https://t.me/c/1234567890/42  или  https://t.me/channelname/42
  const privateMatch = trimmed.match(/https?:\/\/t\.me\/c\/\d+\/(\d+)/i);
  if (privateMatch) {
    return {
      channelMessageId: Number(privateMatch[1]),
      normalizedLink: trimmed,
    };
  }
  const publicMatch = trimmed.match(/https?:\/\/t\.me\/[A-Za-z0-9_]+\/(\d+)/i);
  if (publicMatch) {
    return {
      channelMessageId: Number(publicMatch[1]),
      normalizedLink: trimmed,
    };
  }
  return null;
}
