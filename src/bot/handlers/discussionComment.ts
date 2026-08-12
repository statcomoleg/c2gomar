import { Composer } from 'grammy';
import type { BotContext } from '../context';
import {
  settingsRepo,
  submissionsRepo,
  usersRepo,
} from '../../db/repositories';
import {
  matchTaskWithFallback,
  tryBindDiscussionForward,
} from '../../services/taskMatching';
import * as texts from '../texts';

export const discussionCommentHandler = new Composer<BotContext>();

discussionCommentHandler.on('message', async (ctx, next) => {
  const settings = await settingsRepo.getSettings();
  if (!settings || !ctx.chat || !ctx.message) {
    await next();
    return;
  }

  if (ctx.chat.id !== settings.discussion_group_id) {
    await next();
    return;
  }

  // Автофорвард поста канала → бинд discussion_message_id
  await tryBindDiscussionForward(ctx.message);

  // Отчёт = reply
  if (!ctx.message.reply_to_message || !ctx.from) {
    await next();
    return;
  }

  // Игнор сообщений ботов
  if (ctx.from.is_bot) {
    await next();
    return;
  }

  const task = await matchTaskWithFallback(ctx.message);
  if (!task) {
    await next();
    return;
  }

  const now = new Date();
  const startAt = new Date(settings.marathon_start_at);

  if (task.type === 'pre' && now > startAt) {
    try {
      await ctx.api.sendMessage(ctx.from.id, texts.preTasksClosedText());
    } catch (err) {
      console.error(err);
    }
    return;
  }

  if (task.type === 'main' && now < startAt) {
    try {
      await ctx.api.sendMessage(
        ctx.from.id,
        texts.mainTasksNotOpenText(settings.marathon_start_at),
      );
    } catch (err) {
      console.error(err);
    }
    return;
  }

  await usersRepo.upsertUserProfile({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
  });

  const active = await submissionsRepo.findActiveForUserTask(ctx.from.id, task.id);
  if (active?.status === 'approved') {
    try {
      await ctx.api.sendMessage(ctx.from.id, texts.alreadyApprovedText());
    } catch (err) {
      console.error(err);
    }
    return;
  }

  if (active?.status === 'pending') {
    await submissionsRepo.markSuperseded(active.id);
  }

  const commentText =
    ctx.message.text ||
    ctx.message.caption ||
    '[медиа без текста]';

  await submissionsRepo.createSubmission({
    task_id: task.id,
    user_id: ctx.from.id,
    comment_message_id: ctx.message.message_id,
    comment_text: commentText,
  });

  try {
    await ctx.api.sendMessage(ctx.from.id, texts.submissionReceivedText());
  } catch (err) {
    console.error(err);
  }

  // Проверка только в локальной админке — карточки админам в Telegram не шлём
});
