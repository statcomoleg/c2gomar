import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { settingsRepo } from '../../../db/repositories';
import { processJoin } from '../../../services/joinFlow';

export const joinChannelHandler = new Composer<BotContext>();

joinChannelHandler.callbackQuery('join_channel', async (ctx) => {
  await ctx.answerCallbackQuery(); // убираем «часики» на кнопке

  if (!ctx.from) return;
  const userId = ctx.from.id;

  const settings = await settingsRepo.getSettings();
  if (!settings) {
    await ctx.answerCallbackQuery({ text: 'Ошибка: настройки не найдены' });
    return;
  }

  // Проверяем подписку через getChatMember
  let isMember = false;
  try {
    const member = await ctx.api.getChatMember(settings.channel_id, userId);
    isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
  } catch (err) {
    const code = (err as { error_code?: number }).error_code;
    // 400 = user not found in chat (= left), 403 = forbidden
    if (code !== 400 && code !== 403) {
      // Неожиданная ошибка — пробуем всё равно принять (лучше, чем бесконечная петля)
      console.error('[joinChannel] getChatMember error', err);
    }
    // Не можем проверить — сообщаем пользователю и даём попробовать ещё раз
    await ctx.reply(
      '⚠️ Не смог проверить подписку. Убедитесь, что вы подписаны на канал @content2go, и попробуйте снова.',
    );
    return;
  }

  if (!isMember) {
    await ctx.reply(
      `📢 Вы ещё не подписаны на канал.\n\n` +
        `Сначала подпишитесь: <a href="https://t.me/content2go">@content2go</a>\n` +
        `Затем вернитесь и нажмите кнопку снова.`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );
    return;
  }

  // Пользователь подписан — запускаем flow вступления
  const result = await processJoin(ctx.api, userId, {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
  });

  if (result.alreadyJoined) {
    // Уже участник — просто убираем кнопку из этого сообщения
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    await ctx.reply('Вы уже участник практикума ✅ Добро пожаловать!');
    return;
  }

  // Убираем кнопку из сообщения, где была нажата
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
});
