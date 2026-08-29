import type { Api } from 'grammy';
import { marathonMessagesRepo, refSourcesRepo, settingsRepo } from '../db/repositories';
import type { MarathonMessage, PendingEntry } from '../db/repositories/marathonMessages';

const POLL_INTERVAL_MS = 60_000; // раз в минуту

// ── Подстановка шаблонов ────────────────────────────────────────────────────

export async function applyMarathonTemplates(
  text: string,
  buttonUrl: string | null,
  userPoints: number,
  refCode: string | null,
  marathonStartsAt: string | null,
  defaultRefUrl: string,
): Promise<{ text: string; buttonUrl: string | null }> {
  const refUrl = await refSourcesRepo.resolveRefUrl(refCode, defaultRefUrl);

  const marathonDate = marathonStartsAt
    ? (() => {
        try {
          return (
            new Date(marathonStartsAt).toLocaleString('ru-RU', {
              timeZone: 'Europe/Moscow',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }) + ' (МСК)'
          );
        } catch {
          return 'скоро (МСК)';
        }
      })()
    : 'скоро (МСК)';

  const apply = (s: string) =>
    s
      .replace(/\{\{REF_URL\}\}/g, refUrl)
      .replace(/\{\{MARATHON_DATE\}\}/g, marathonDate)
      .replace(/\{\{USER_POINTS\}\}/g, String(userPoints));

  return { text: apply(text), buttonUrl: buttonUrl ? apply(buttonUrl) : null };
}

// ── Отправка одного сообщения (шаблон) ──────────────────────────────────────

export async function sendMarathonMessage(
  api: Api,
  msg: MarathonMessage,
  userId: number,
  userPoints: number,
  refCode: string | null,
  marathonStartsAt: string | null,
  defaultRefUrl: string,
  /** Если true — не проверяем условие min/max баллов (тест-режим) */
  ignorePointsCondition = false,
): Promise<void> {
  if (!ignorePointsCondition) {
    if (msg.min_points !== null && userPoints < msg.min_points) return;
    if (msg.max_points !== null && userPoints > msg.max_points) return;
  }

  const { text, buttonUrl } = await applyMarathonTemplates(
    msg.text,
    msg.button_url,
    userPoints,
    refCode,
    marathonStartsAt,
    defaultRefUrl,
  );

  const replyMarkup =
    msg.button_text && buttonUrl
      ? { inline_keyboard: [[{ text: msg.button_text, url: buttonUrl }]] }
      : undefined;

  if (msg.media_type === 'video_note' && msg.media_file_id) {
    await api.sendVideoNote(userId, msg.media_file_id);
  } else if (msg.media_type === 'photo' && msg.media_file_id) {
    await api.sendPhoto(userId, msg.media_file_id);
  }

  if (text) {
    await api.sendMessage(userId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: replyMarkup,
    });
  }
}

// ── Отправка записи из очереди ───────────────────────────────────────────────

async function sendEntry(api: Api, entry: PendingEntry, defaultRefUrl: string): Promise<void> {
  const { message: msg, user_id, user_total_points, user_ref_code, user_marathon_starts_at } =
    entry;

  try {
    await sendMarathonMessage(
      api, msg, user_id, user_total_points, user_ref_code, user_marathon_starts_at, defaultRefUrl,
    );
  } catch (err) {
    const code = (err as { error_code?: number }).error_code;
    if (code === 403) {
      console.warn(`[scheduler] user=${user_id} blocked bot, skipping msg=${msg.id}`);
      return;
    }
    throw err;
  }
}

// ── Основной цикл ────────────────────────────────────────────────────────────

async function tick(api: Api): Promise<void> {
  let entries: PendingEntry[];
  try {
    entries = await marathonMessagesRepo.fetchDue(100);
  } catch (err) {
    console.error('[scheduler] fetchDue error', err);
    return;
  }
  if (entries.length === 0) return;

  const settings = await settingsRepo.getSettings().catch(() => null);
  const defaultRefUrl = settings?.default_ref_url ?? 'https://content2go.app/refH4kGr6DM';

  for (const entry of entries) {
    try {
      await sendEntry(api, entry, defaultRefUrl);
      await marathonMessagesRepo.markSent(entry.id);
    } catch (err) {
      console.error(`[scheduler] failed user=${entry.user_id} msg=${entry.message_id}`, err);
    }
  }

  console.log(`[scheduler] processed ${entries.length} messages`);
}

// ── Публичные функции ────────────────────────────────────────────────────────

/** Ставим все сообщения для нового участника в очередь */
export async function enqueueUserMessages(
  userId: number,
  joinedAt: string,
  marathonStartsAt: string,
): Promise<void> {
  await marathonMessagesRepo.enqueueForUser(userId, joinedAt, marathonStartsAt);
}

/** Запускаем шедулер в index.ts после инициализации бота */
export function startScheduler(api: Api): void {
  console.log('[scheduler] started (interval 60s)');
  // Первый тик сразу
  void tick(api);
  setInterval(() => void tick(api), POLL_INTERVAL_MS);
}
