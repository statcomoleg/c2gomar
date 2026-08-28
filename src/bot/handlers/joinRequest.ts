import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { settingsRepo } from '../../db/repositories';
import { processJoin } from '../../services/joinFlow';

export const joinRequestHandler = new Composer<BotContext>();

// Для приватных каналов с заявками (на случай если канал будет закрытым)
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

  await processJoin(ctx.api, userId, {
    username: ctx.chatJoinRequest.from.username,
    first_name: ctx.chatJoinRequest.from.first_name,
  });
});
