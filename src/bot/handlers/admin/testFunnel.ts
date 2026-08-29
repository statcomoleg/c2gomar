import { Composer } from 'grammy';
import { requireAdmin } from '../../middleware/isAdmin';
import { marathonMessagesRepo } from '../../../db/repositories';
import type { MarathonMessage } from '../../../db/repositories/marathonMessages';
import { sendMarathonMessage, applyMarathonTemplates } from '../../../services/marathonScheduler';
import { settingsRepo, refSourcesRepo, usersRepo } from '../../../db/repositories';
import type { BotContext } from '../../context';

const STEP_INTERVAL_MS = 20_000; // 20 секунд между письмами

function buildTestNote(msg: MarathonMessage, index: number, total: number): string {
  const base = msg.offset_base === 'join' ? 'после вступления' : 'от старта марафона';
  const abs = Math.abs(msg.offset_seconds);
  const sign = msg.offset_seconds < 0 ? '–' : '+';
  let when: string;
  if (abs < 3600) {
    when = `${sign}${abs / 60} мин ${base}`;
  } else if (abs < 86400) {
    when = `${sign}${abs / 3600} ч ${base}`;
  } else {
    const d = Math.floor(abs / 86400);
    const h = (abs % 86400) / 3600;
    when = `${sign}${d} д ${h > 0 ? h + ' ч' : ''} ${base}`;
  }

  const conditions: string[] = [];
  if (msg.min_points !== null) conditions.push(`≥ ${msg.min_points} баллов`);
  if (msg.max_points !== null) conditions.push(`≤ ${msg.max_points} баллов`);

  const mediaNote = msg.media_type === 'video_note'
    ? `\n🎥 <i>Перед этим: видео-кружок${msg.media_file_id ? '' : ' (file_id не задан — пропускается)'}</i>`
    : '';

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔧 <b>[ТЕСТ] Письмо ${index}/${total}</b>\n` +
    `⏱ <b>Когда:</b> ${when}\n` +
    (conditions.length ? `✅ <b>Условие:</b> ${conditions.join(', ')}\n` : '') +
    `📌 <b>step_order:</b> ${msg.step_order}` +
    mediaNote +
    `\n━━━━━━━━━━━━━━━━━━━━━━`
  );
}

export const testFunnelHandler = new Composer<BotContext>();

testFunnelHandler.command('testfunnel', requireAdmin, async (ctx) => {
  const userId = ctx.from!.id;
  const messages = await marathonMessagesRepo.listMessages();

  if (messages.length === 0) {
    await ctx.reply('Таблица marathon_messages пуста. Запустите seed-скрипт.');
    return;
  }

  const settings = await settingsRepo.getSettings().catch(() => null);
  const defaultRefUrl = settings?.default_ref_url ?? 'https://content2go.app/refH4kGr6DM';

  const dbUser = await usersRepo.findUserById(userId);
  const refCode = dbUser?.ref_code ?? null;
  const userPoints = dbUser?.total_points ?? 0;

  // Фейковая дата марафона: послезавтра 10:00 МСК
  const fakeMarathonStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    // 10:00 МСК = 07:00 UTC
    d.setUTCHours(7, 0, 0, 0);
    return d.toISOString();
  })();

  const total = messages.length;

  await ctx.reply(
    `🔧 <b>Тест-режим воронки запущен</b>\n\n` +
    `Всего писем: <b>${total}</b>\n` +
    `Интервал: <b>20 секунд</b>\n` +
    `Фейковые баллы: <b>${userPoints}</b> (реальные из вашего аккаунта)\n` +
    `Фейковая дата марафона: <b>послезавтра 10:00 МСК</b>\n\n` +
    `⚠️ Условные письма (финал) показываются <b>оба</b> независимо от баллов.\n` +
    `Начинаю через 5 секунд...`,
    { parse_mode: 'HTML' },
  );

  messages.forEach((msg, i) => {
    const delay = 5_000 + i * STEP_INTERVAL_MS;

    setTimeout(async () => {
      try {
        // Системная пометка
        const note = buildTestNote(msg, i + 1, total);
        await ctx.api.sendMessage(userId, note, { parse_mode: 'HTML' });

        // Само письмо — для финальных (условных) отправляем всегда
        await sendMarathonMessage(
          ctx.api,
          msg,
          userId,
          userPoints,
          refCode,
          fakeMarathonStart,
          defaultRefUrl,
          /* ignorePointsCondition */ true,
        );
      } catch (err) {
        console.error('[testFunnel] error step', msg.step_order, err);
        await ctx.api
          .sendMessage(userId, `❌ Ошибка при отправке письма step=${msg.step_order}: ${String(err)}`)
          .catch(() => {});
      }
    }, delay);
  });
});
