import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { z } from 'zod';
import type { BotContext } from '../context';
import { tasksRepo } from '../../db/repositories';
import { parseChannelPostLink } from '../../config';
import * as texts from '../texts';
import type { TaskType } from '../../types';

type MyConversation = Conversation<BotContext, BotContext>;

export async function addTaskConversation(
  conversation: MyConversation,
  ctx: BotContext,
) {
  const typeKb = new InlineKeyboard()
    .text('ПДЗ', 'task_type:pre')
    .text('ДЗ', 'task_type:main');
  await ctx.reply('Тип задания:', { reply_markup: typeKb });

  const typeCb = await conversation.waitFor('callback_query:data');
  await typeCb.answerCallbackQuery();
  const typeData = typeCb.callbackQuery.data;
  if (typeData !== 'task_type:pre' && typeData !== 'task_type:main') {
    await ctx.reply('Отмена.');
    return;
  }
  const type: TaskType = typeData.endsWith('pre') ? 'pre' : 'main';

  await ctx.reply('Краткое описание (до 500 символов):');
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text.trim();
  if (description.length === 0 || description.length > 500) {
    await ctx.reply('Описание должно быть от 1 до 500 символов. Отмена.');
    return;
  }

  await ctx.reply(
    'Ссылка на пост в канале:\nПример: https://t.me/c/1234567890/42',
  );
  const linkCtx = await conversation.waitFor('message:text');
  const parsed = parseChannelPostLink(linkCtx.message.text);
  if (!parsed) {
    await ctx.reply(texts.invalidPostLinkText());
    return;
  }

  const existing = await conversation.external(() =>
    tasksRepo.findByChannelMessageId(parsed.channelMessageId),
  );
  if (existing) {
    await ctx.reply(texts.taskExistsText(existing.label));
    return;
  }

  const count = await conversation.external(() => tasksRepo.countByType(type));
  const label = type === 'pre' ? `ПДЗ ${count + 1}` : `ДЗ ${count + 1}`;

  const confirmKb = new InlineKeyboard()
    .text('Подтвердить', 'task_yes')
    .text('Отмена', 'task_no');

  await ctx.reply(
    `Создать?\n${label}\n${description}\n${parsed.normalizedLink}\nid поста: ${parsed.channelMessageId}`,
    { reply_markup: confirmKb },
  );

  const conf = await conversation.waitFor('callback_query:data');
  await conf.answerCallbackQuery();
  if (conf.callbackQuery.data !== 'task_yes') {
    await ctx.reply('Отменено.');
    return;
  }

  // Валидация через zod на всякий случай
  z.object({
    type: z.enum(['pre', 'main']),
    description: z.string().min(1).max(500),
    channelMessageId: z.number().int().positive(),
  }).parse({ type, description, channelMessageId: parsed.channelMessageId });

  const task = await conversation.external(() =>
    tasksRepo.createTask({
      type,
      label,
      description,
      channel_post_link: parsed.normalizedLink,
      channel_message_id: parsed.channelMessageId,
      created_by: ctx.from!.id,
    }),
  );

  await ctx.reply(texts.taskCreatedText(task));
  await ctx.reply(
    'Когда под постом появится первый комментарий (или автофорвард в чат обсуждений), ' +
      'бот сам привяжет discussion_message_id.',
  );
}
