import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { requireAdmin } from '../../middleware/isAdmin';
import {
  submissionsRepo,
  tasksRepo,
  usersRepo,
} from '../../../db/repositories';
import { awardPoints } from '../../../services/points';
import * as texts from '../../texts';
import { adminMainKeyboard } from '../../keyboards';

export const adminMenuHandler = new Composer<BotContext>();

adminMenuHandler.command('admin', requireAdmin, async (ctx) => {
  await ctx.reply(texts.adminMenuText(), {
    reply_markup: adminMainKeyboard(),
  });
});

adminMenuHandler.command('debug_chat_id', requireAdmin, async (ctx) => {
  if (!ctx.chat) return;
  await ctx.reply(texts.debugChatIdText(ctx.chat.id, ctx.chat.type));
});

/** Ревью заявки: reject | +3 | +10 */
export const reviewHandler = new Composer<BotContext>();

reviewHandler.callbackQuery(/^review:(\d+):(reject|3|10)$/, requireAdmin, async (ctx) => {
  if (!ctx.from) return;
  const submissionId = Number(ctx.match[1]);
  const action = ctx.match[2];

  const existing = await submissionsRepo.getSubmissionById(submissionId);
  if (!existing) {
    await ctx.answerCallbackQuery({ text: 'Заявка не найдена' });
    return;
  }

  if (existing.status !== 'pending') {
    const reviewer = existing.reviewed_by
      ? await usersRepo.findUserById(existing.reviewed_by)
      : null;
    const name = reviewer
      ? texts.displayName(reviewer)
      : String(existing.reviewed_by ?? 'админ');
    await ctx.answerCallbackQuery({ text: texts.alreadyProcessedText(name) });
    return;
  }

  const task = await tasksRepo.getTaskById(existing.task_id);
  if (!task) {
    await ctx.answerCallbackQuery({ text: 'Задание не найдено' });
    return;
  }

  const adminName = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name || String(ctx.from.id);

  if (action === 'reject') {
    const updated = await submissionsRepo.reviewSubmission({
      id: submissionId,
      status: 'rejected',
      reviewed_by: ctx.from.id,
    });
    if (!updated) {
      await ctx.answerCallbackQuery({ text: texts.alreadyProcessedText(adminName) });
      return;
    }

    const suffix = texts.submissionProcessedText(adminName, 'на доработку');
    try {
      await ctx.editMessageText((ctx.callbackQuery.message?.text ?? '') + suffix, {
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      /* ignore */
    }
    await ctx.answerCallbackQuery({ text: 'Отправлено на доработку' });

    try {
      await ctx.api.sendMessage(existing.user_id, texts.taskRejectedText(task.label));
    } catch (err) {
      console.error(err);
    }
    return;
  }

  const points = Number(action);
  const updated = await submissionsRepo.reviewSubmission({
    id: submissionId,
    status: 'approved',
    points_awarded: points,
    reviewed_by: ctx.from.id,
  });
  if (!updated) {
    await ctx.answerCallbackQuery({ text: texts.alreadyProcessedText(adminName) });
    return;
  }

  const { newTotal } = await awardPoints({
    userId: existing.user_id,
    points,
    reason: 'task_approved',
    relatedSubmissionId: submissionId,
    relatedTaskId: task.id,
    adminId: ctx.from.id,
  });

  const suffix = texts.submissionProcessedText(adminName, `+${points} баллов`);
  try {
    await ctx.editMessageText((ctx.callbackQuery.message?.text ?? '') + suffix, {
      reply_markup: { inline_keyboard: [] },
    });
  } catch {
    /* ignore */
  }
  await ctx.answerCallbackQuery({ text: `+${points}` });

  try {
    await ctx.api.sendMessage(
      existing.user_id,
      texts.taskApprovedText(task.label, points, newTotal),
    );
  } catch (err) {
    console.error(err);
  }
});
