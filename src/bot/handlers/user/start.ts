import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { usersRepo } from '../../../db/repositories';
import { startOnboarding } from '../../../services/onboarding';
import * as texts from '../../texts';
import { removeUserKeyboard, urlButtonKeyboard, userMainKeyboard } from '../../keyboards';
import {
  getChannelInviteLink,
  hasJoinedChannel,
} from '../../middleware/requireJoined';

export const startHandler = new Composer<BotContext>();

startHandler.command('start', async (ctx) => {
  if (!ctx.from) return;

  const existing = await usersRepo.findUserById(ctx.from.id);
  if (existing) {
    await usersRepo.upsertUserProfile({
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
    });

    if (existing.joined_channel_at) {
      await ctx.reply(texts.welcomeBackText(), {
        reply_markup: userMainKeyboard(),
      });
      return;
    }

    const link = await getChannelInviteLink();
    await ctx.reply(texts.welcomeBackNeedChannelText(), {
      reply_markup: removeUserKeyboard(),
    });
    await ctx.reply(texts.joinChannelHintText(), {
      reply_markup: urlButtonKeyboard('Присоединиться к практикуму', link),
    });
    return;
  }

  await usersRepo.createUser({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
  });

  void startOnboarding(ctx.api, ctx.from.id);
});

startHandler.command('menu', async (ctx) => {
  if (!ctx.from) return;
  if (!(await hasJoinedChannel(ctx.from.id))) {
    const link = await getChannelInviteLink();
    await ctx.reply(texts.needChannelText(), {
      reply_markup: removeUserKeyboard(),
    });
    await ctx.reply(texts.joinChannelHintText(), {
      reply_markup: urlButtonKeyboard('Присоединиться к практикуму', link),
    });
    return;
  }
  await ctx.reply(texts.marathonMenuText(), {
    reply_markup: userMainKeyboard(),
  });
});
