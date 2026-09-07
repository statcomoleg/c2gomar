import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { usersRepo, refSourcesRepo } from '../../../db/repositories';
import { startOnboarding } from '../../../services/onboarding';
import * as texts from '../../texts';
import { removeUserKeyboard, userMainKeyboard } from '../../keyboards';
import {
  hasJoinedChannel,
  replyNeedChannel,
} from '../../middleware/requireJoined';

export const startHandler = new Composer<BotContext>();

startHandler.command('start', async (ctx) => {
  if (!ctx.from) return;

  // Захватываем реф-код из параметра /start (напр. /start 4821)
  const rawParam = ctx.match?.trim() ?? '';
  const refCode = rawParam || null;

  const existing = await usersRepo.findUserById(ctx.from.id);
  if (existing) {
    await usersRepo.upsertUserProfile({
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
    });

    // Если пришёл с рефом — пробуем записать (первый реф побеждает)
    if (refCode) {
      const src = await refSourcesRepo.findByCode(refCode);
      if (src) {
        await usersRepo.setRefCode(ctx.from.id, refCode);
        await refSourcesRepo.incrementClicks(refCode);
      }
    }

    if (existing.joined_channel_at) {
      await ctx.reply(texts.welcomeBackText(), {
        reply_markup: userMainKeyboard(),
      });
      return;
    }

    // Не вступил в канал — заново запускаем прогрев с первого письма
    await usersRepo.setOnboardingStep(ctx.from.id, 0);
    void startOnboarding(ctx.api, ctx.from.id);
    return;
  }

  await usersRepo.createUser({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
  });

  // Записываем реф-код новому пользователю
  if (refCode) {
    const src = await refSourcesRepo.findByCode(refCode);
    if (src) {
      await usersRepo.setRefCode(ctx.from.id, refCode);
      await refSourcesRepo.incrementClicks(refCode);
    }
  }

  void startOnboarding(ctx.api, ctx.from.id);
});

startHandler.command('menu', async (ctx) => {
  if (!ctx.from) return;
  if (!(await hasJoinedChannel(ctx.from.id))) {
    await replyNeedChannel(ctx);
    return;
  }
  await ctx.reply(texts.marathonMenuText(), {
    reply_markup: userMainKeyboard(),
  });
});
