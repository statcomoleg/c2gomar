import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { settingsRepo } from '../../../db/repositories';
import { processJoin } from '../../../services/joinFlow';

export const joinChannelHandler = new Composer<BotContext>();

joinChannelHandler.callbackQuery('join_channel', async (ctx) => {
  await ctx.answerCallbackQuery(); // убираем «часики» на кнопке

  if (!ctx.from) return;
  const userId = ctx.from.id;
  console.log('[joinChannel] callback from userId:', userId);

  // DEBUG — временно, чтобы убедиться что handler достигается
  await ctx.reply(`🔍 [DEBUG] Обработчик нажатия кнопки достигнут. userId=${userId}\nСейчас проверяем подписку…`);

  const settings = await settingsRepo.getSettings();
  if (!settings) {
    console.error('[joinChannel] settings not found');
    await ctx.reply('⚠️ Ошибка конфигурации. Напишите /start или обратитесь в поддержку.');
    return;
  }

  // Проверяем подписку через getChatMember
  let isMember = false;
  try {
    const member = await ctx.api.getChatMember(settings.channel_id, userId);
    console.log('[joinChannel] member status:', member.status, 'userId:', userId);
    isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
  } catch (err) {
    const code = (err as { error_code?: number }).error_code;
    console.error('[joinChannel] getChatMember error code:', code, err);
    // Не можем проверить — сообщаем пользователю и даём попробовать ещё раз
    await ctx.reply(
      '⚠️ Не смог проверить подписку. Убедитесь, что вы подписаны на канал @content2go, и попробуйте снова.',
    );
    return;
  }

  if (!isMember) {
    console.log('[joinChannel] not a member, userId:', userId);
    await ctx.reply(
      `📢 Вы ещё не подписаны на канал.\n\n` +
        `Сначала подпишитесь: <a href="https://t.me/content2go">@content2go</a>\n` +
        `Затем вернитесь и нажмите кнопку снова.`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );
    return;
  }

  // Пользователь подписан — запускаем flow вступления
  try {
    console.log('[joinChannel] calling processJoin for userId:', userId);
    const result = await processJoin(ctx.api, userId, {
      username: ctx.from.username,
      first_name: ctx.from.first_name,
    });
    console.log('[joinChannel] processJoin result:', JSON.stringify(result));

    if (result.alreadyJoined) {
      // Уже участник — убираем кнопку и сообщаем
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
      await ctx.reply('Вы уже участник практикума ✅ Добро пожаловать!');
      return;
    }

    // Убираем кнопку из сообщения, где была нажата
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    console.log('[joinChannel] join successful for userId:', userId);
  } catch (err) {
    console.error('[joinChannel] processJoin error for userId:', userId, err);
    await ctx.reply(
      '⚠️ Произошла ошибка при обработке. Попробуйте нажать кнопку ещё раз или напишите /start.',
    );
  }
});
