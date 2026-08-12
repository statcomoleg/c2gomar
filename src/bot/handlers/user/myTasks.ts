import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { submissionsRepo, tasksRepo } from '../../../db/repositories';
import * as texts from '../../texts';
import { tasksListKeyboard } from '../../keyboards';
import { requireJoinedChannel } from '../../middleware/requireJoined';

export const myTasksHandler = new Composer<BotContext>();

myTasksHandler.hears('Мои задания', requireJoinedChannel, async (ctx) => {
  if (!ctx.from) return;
  const tasks = await tasksRepo.listActiveTasks();
  if (tasks.length === 0) {
    await ctx.reply(texts.noTasksText());
    return;
  }

  const approved = new Set<number>();
  for (const t of tasks) {
    const sub = await submissionsRepo.findActiveForUserTask(ctx.from.id, t.id);
    if (sub?.status === 'approved') approved.add(t.id);
  }

  await ctx.reply('Ваши задания:', {
    reply_markup: tasksListKeyboard(tasks, approved),
  });
});

myTasksHandler.callbackQuery(/^task:(\d+)$/, requireJoinedChannel, async (ctx) => {
  if (!ctx.from) return;
  const taskId = Number(ctx.match[1]);
  const task = await tasksRepo.getTaskById(taskId);
  if (!task) {
    await ctx.answerCallbackQuery({ text: 'Задание не найдено' });
    return;
  }
  const sub = await submissionsRepo.findLatestForUserTask(ctx.from.id, taskId);
  await ctx.answerCallbackQuery();
  await ctx.reply(texts.taskDetailText(task, sub), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
});
