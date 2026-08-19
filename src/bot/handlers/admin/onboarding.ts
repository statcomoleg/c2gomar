import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { requireAdmin } from '../../middleware/isAdmin';
import { onboardingRepo } from '../../../db/repositories';
import * as texts from '../../texts';
import {
  onboardingEditKeyboard,
  onboardingStepKeyboard,
} from '../../keyboards';

export const onboardingAdminHandler = new Composer<BotContext>();

onboardingAdminHandler.hears('Онбординг', requireAdmin, async (ctx) => {
  const messages = await onboardingRepo.listOnboardingMessages();
  await ctx.reply(texts.onboardingListText(messages), {
    reply_markup: onboardingStepKeyboard(messages),
  });
});

onboardingAdminHandler.callbackQuery('ob:list', requireAdmin, async (ctx) => {
  const messages = await onboardingRepo.listOnboardingMessages();
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(texts.onboardingListText(messages), {
    reply_markup: onboardingStepKeyboard(messages),
  });
});

onboardingAdminHandler.callbackQuery(/^ob:edit:(\d+)$/, requireAdmin, async (ctx) => {
  const id = Number(ctx.match[1]);
  const msg = await onboardingRepo.getOnboardingById(id);
  if (!msg) {
    await ctx.answerCallbackQuery({ text: 'Не найдено' });
    return;
  }
  await ctx.answerCallbackQuery();
  const preview = msg.text.slice(0, 500);
  await ctx.editMessageText(
    `Шаг ${msg.step_order} (id=${msg.id})\nЗадержка: ${msg.delay_seconds}с\n\n${preview}`,
    { reply_markup: onboardingEditKeyboard(id), parse_mode: 'HTML' },
  );
});

onboardingAdminHandler.callbackQuery(/^ob:text:(\d+)$/, requireAdmin, async (ctx) => {
  const id = Number(ctx.match[1]);
  ctx.session.editOnboardingId = id;
  ctx.session.editOnboardingField = 'text';
  await ctx.answerCallbackQuery();
  await ctx.reply(
    'Пришлите новый текст шага (HTML: <b>жирный</b>, <a href="url">ссылка</a>).',
  );
});

onboardingAdminHandler.callbackQuery(/^ob:delay:(\d+)$/, requireAdmin, async (ctx) => {
  const id = Number(ctx.match[1]);
  ctx.session.editOnboardingId = id;
  ctx.session.editOnboardingField = 'delay';
  await ctx.answerCallbackQuery();
  await ctx.reply('Пришлите задержку в секундах (целое число, относительно предыдущего шага).');
});

onboardingAdminHandler.callbackQuery('ob:save_circle', requireAdmin, async (ctx) => {
  ctx.session.awaitingCircle = true;
  await ctx.answerCallbackQuery();
  await ctx.reply(texts.saveCircleHelpText());
});

onboardingAdminHandler.command('save_circle', requireAdmin, async (ctx) => {
  ctx.session.awaitingCircle = true;
  await ctx.reply(texts.saveCircleHelpText());
});

/** Приём правок текста/delay и кружка — только для админов; не-админы всегда идут дальше */
onboardingAdminHandler.on('message', async (ctx, next) => {
  if (!ctx.isAdmin) return next();
  if (!ctx.from || !ctx.message) {
    await next();
    return;
  }

  // Кружок
  if (ctx.session.awaitingCircle && ctx.message.video_note) {
    const fileId = ctx.message.video_note.file_id;
    const step = await onboardingRepo.findVideoNoteStep();
    if (!step) {
      await ctx.reply('Нет шага с media_type=video_note. Добавьте его в БД.');
      ctx.session.awaitingCircle = false;
      return;
    }
    await onboardingRepo.setOnboardingMedia(step.id, 'video_note', fileId);
    ctx.session.awaitingCircle = false;
    await ctx.reply(texts.circleSavedText(step.step_order));
    return;
  }

  // Редактирование поля
  if (ctx.session.editOnboardingId && ctx.session.editOnboardingField) {
    const id = ctx.session.editOnboardingId;
    const field = ctx.session.editOnboardingField;

    if (field === 'text' && ctx.message.text) {
      await onboardingRepo.updateOnboardingText(id, ctx.message.text);
      ctx.session.editOnboardingId = undefined;
      ctx.session.editOnboardingField = undefined;
      await ctx.reply('Текст обновлён.');
      return;
    }

    if (field === 'delay' && ctx.message.text) {
      const n = Number(ctx.message.text.trim());
      if (!Number.isInteger(n) || n < 0) {
        await ctx.reply('Нужно целое число ≥ 0.');
        return;
      }
      await onboardingRepo.updateOnboardingDelay(id, n);
      ctx.session.editOnboardingId = undefined;
      ctx.session.editOnboardingField = undefined;
      await ctx.reply(`Задержка обновлена: ${n}с.`);
      return;
    }
  }

  await next();
});
