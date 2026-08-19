import 'dotenv/config';
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { run } from '@grammyjs/runner';
import { loadEnv } from './config';
import type { BotContext, SessionData } from './bot/context';
import { isAdminMiddleware } from './bot/middleware/isAdmin';
import { adminsRepo, settingsRepo } from './db/repositories';
import { startHandler } from './bot/handlers/user/start';
import { myTasksHandler } from './bot/handlers/user/myTasks';
import { rankingHandler } from './bot/handlers/user/ranking';
import { joinRequestHandler } from './bot/handlers/joinRequest';
import { discussionCommentHandler } from './bot/handlers/discussionComment';
import { adminMenuHandler, reviewHandler } from './bot/handlers/admin/menu';
import { promoCodeHandler } from './bot/handlers/user/promoCode';
import { onboardingAdminHandler } from './bot/handlers/admin/onboarding';
import { awardConversation } from './bot/conversations/award';
import { addTaskConversation } from './bot/conversations/addTask';
import { broadcastConversation } from './bot/conversations/broadcast';
import * as texts from './bot/texts';
import { requireAdmin } from './bot/middleware/isAdmin';

async function main() {
  const env = loadEnv();
  process.env.TZ = env.TZ;

  const settings = await settingsRepo.getSettings();
  if (!settings) {
    throw new Error(texts.settingsMissingText());
  }
  if (settings.channel_id === -1000000000000) {
    console.warn(
      '[warn] app_settings.channel_id — плейсхолдер. Замените на реальный id канала перед продом.',
    );
  }

  await adminsRepo.ensureAdminsFromEnv(env.adminIds);

  const bot = new Bot<BotContext>(env.BOT_TOKEN);

  bot.use(
    session({
      initial: (): SessionData => ({}),
    }),
  );
  bot.use(conversations());
  bot.use(isAdminMiddleware);

  bot.use(createConversation(awardConversation, 'award'));
  bot.use(createConversation(addTaskConversation, 'addTask'));
  bot.use(createConversation(broadcastConversation, 'broadcast'));

  // Ошибки — не роняем процесс
  bot.catch((err) => {
    console.error('[bot.catch]', err.error);
  });

  bot.use(joinRequestHandler);
  bot.use(discussionCommentHandler);

  bot.use(startHandler);
  bot.use(myTasksHandler);
  bot.use(rankingHandler);

  bot.use(adminMenuHandler);
  bot.use(reviewHandler);
  bot.use(onboardingAdminHandler);
  bot.use(promoCodeHandler);

  // Старт диалогов админа по кнопкам reply-клавиатуры
  bot.hears('Начислить', requireAdmin, async (ctx) => {
    await ctx.conversation.enter('award');
  });
  bot.hears('Добавить задание', requireAdmin, async (ctx) => {
    await ctx.conversation.enter('addTask');
  });
  bot.hears('Рассылка', requireAdmin, async (ctx) => {
    await ctx.conversation.enter('broadcast');
  });

  console.log('Бот запускается (long polling)…');
  run(bot);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
