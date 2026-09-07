import type { Api } from 'grammy';
import { usersRepo, settingsRepo } from '../../db/repositories';
import type { BotContext } from '../context';
import * as texts from '../texts';
import { joinWithChannelKeyboard, removeUserKeyboard, userMainKeyboard } from '../keyboards';

const FALLBACK_INVITE = 'https://t.me/+4zgobAW0C-wzYjYy';

export async function getChannelInviteLink(): Promise<string> {
  const settings = await settingsRepo.getSettings();
  return settings?.channel_invite_link || FALLBACK_INVITE;
}

export async function hasJoinedChannel(userId: number): Promise<boolean> {
  const user = await usersRepo.findUserById(userId);
  return Boolean(user?.joined_channel_at);
}

/** Ответ «сначала вступите в канал» + кнопки: ссылка на канал + «Я подписался» */
export async function replyNeedChannel(ctx: BotContext): Promise<void> {
  const link = await getChannelInviteLink();
  await ctx.reply(texts.needChannelText(), {
    reply_markup: removeUserKeyboard(),
  });
  await ctx.reply(texts.joinChannelHintText(), {
    reply_markup: joinWithChannelKeyboard(link),
  });
}

export async function sendNeedChannel(api: Api, userId: number): Promise<void> {
  const link = await getChannelInviteLink();
  await api.sendMessage(userId, texts.needChannelText(), {
    reply_markup: removeUserKeyboard(),
  });
  await api.sendMessage(userId, texts.joinChannelHintText(), {
    reply_markup: joinWithChannelKeyboard(link),
  });
}

export async function sendMarathonMenu(api: Api, userId: number): Promise<void> {
  await api.sendMessage(userId, texts.marathonMenuText(), {
    reply_markup: userMainKeyboard(),
  });
}

/**
 * Middleware: марафонные действия только после вступления в канал.
 * Админы тоже подчиняются этому правилу для user-кнопок (админка — через /admin).
 */
export async function requireJoinedChannel(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  if (!ctx.from) return;
  if (await hasJoinedChannel(ctx.from.id)) {
    await next();
    return;
  }
  await replyNeedChannel(ctx);
}
