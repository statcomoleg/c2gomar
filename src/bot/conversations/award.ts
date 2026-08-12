import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { z } from 'zod';
import type { BotContext } from '../context';
import { usersRepo } from '../../db/repositories';
import { awardPoints } from '../../services/points';
import * as texts from '../texts';

type MyConversation = Conversation<BotContext, BotContext>;

export async function awardConversation(conversation: MyConversation, ctx: BotContext) {
  await ctx.reply(
    'Перешлите сообщение пользователя ИЛИ отправьте его Telegram ID / @username.',
  );

  const idCtx = await conversation.waitFor('message');
  let userId: number | null = null;
  let label = '';

  const msg = idCtx.message;
  if (!msg) {
    await ctx.reply('Отмена.');
    return;
  }

  const origin = msg.forward_origin;
  if (origin && origin.type === 'user') {
    userId = origin.sender_user.id;
    label = origin.sender_user.username
      ? `@${origin.sender_user.username}`
      : origin.sender_user.first_name || String(userId);
  } else if (msg.text) {
    const raw = msg.text.trim();
    if (/^\d+$/.test(raw)) {
      userId = Number(raw);
      const u = await conversation.external(() => usersRepo.findUserById(userId!));
      label = u ? texts.displayName(u) : String(userId);
    } else {
      const u = await conversation.external(() => usersRepo.findUserByUsername(raw));
      if (!u) {
        await ctx.reply('Пользователь не найден в базе бота. Нужен ID или @username из /start.');
        return;
      }
      userId = u.id;
      label = texts.displayName(u);
    }
  } else {
    await ctx.reply('Не понял. Отмена.');
    return;
  }

  await ctx.reply('Введите количество баллов (целое, можно отрицательное):');
  const ptsCtx = await conversation.waitFor('message:text');
  const parsed = z.coerce.number().int().safeParse(ptsCtx.message.text.trim());
  if (!parsed.success) {
    await ctx.reply('Нужно целое число. Отмена.');
    return;
  }
  const points = parsed.data;

  const kb = new InlineKeyboard()
    .text('Подтвердить', 'award_yes')
    .text('Отмена', 'award_no');

  await ctx.reply(texts.awardConfirmText(points, label, userId!), {
    reply_markup: kb,
  });

  const conf = await conversation.waitFor('callback_query:data');
  await conf.answerCallbackQuery();
  if (conf.callbackQuery.data !== 'award_yes') {
    await ctx.reply('Отменено.');
    return;
  }

  const targetId = userId!;
  const result = await conversation.external(() =>
    awardPoints({
      userId: targetId,
      points,
      reason: 'manual',
      adminId: ctx.from!.id,
    }),
  );

  await ctx.reply(`Готово. Новый баланс: ${result.newTotal}.`);

  try {
    await ctx.api.sendMessage(
      targetId,
      texts.manualPointsText(points, result.newTotal),
    );
  } catch (err) {
    console.error('[award] notify user', err);
  }
}
