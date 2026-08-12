import { Composer, InputFile } from 'grammy';
import path from 'path';
import type { BotContext } from '../context';
import { settingsRepo, usersRepo } from '../../db/repositories';
import * as texts from '../texts';
import { userMainKeyboard } from '../keyboards';

const MENU_IMAGE = path.resolve(
  process.cwd(),
  'assets/onboarding/menu_practicum.png',
);
const FALLBACK_INVITE = 'https://t.me/+4zgobAW0C-wzYjYy';

export const joinRequestHandler = new Composer<BotContext>();

joinRequestHandler.on('chat_join_request', async (ctx) => {
  const settings = await settingsRepo.getSettings();
  if (!settings) return;

  const chatId = ctx.chatJoinRequest.chat.id;
  if (chatId !== settings.channel_id) return;

  const userId = ctx.chatJoinRequest.from.id;

  try {
    await ctx.api.approveChatJoinRequest(chatId, userId);
  } catch (err) {
    console.error('[joinRequest] approve failed', err);
    return;
  }

  const existing = await usersRepo.findUserById(userId);
  if (!existing) {
    await usersRepo.createUser({
      id: userId,
      username: ctx.chatJoinRequest.from.username,
      first_name: ctx.chatJoinRequest.from.first_name,
    });
  } else {
    await usersRepo.upsertUserProfile({
      id: userId,
      username: ctx.chatJoinRequest.from.username,
      first_name: ctx.chatJoinRequest.from.first_name,
    });
  }

  await usersRepo.markJoinedChannel(userId);

  const invite = settings.channel_invite_link || FALLBACK_INVITE;

  try {
    await ctx.api.sendPhoto(userId, new InputFile(MENU_IMAGE));
    await ctx.api.sendMessage(userId, texts.channelOpenedText(invite), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: userMainKeyboard(),
    });
  } catch (err) {
    console.error('[joinRequest] notify user failed', err);
  }
});
