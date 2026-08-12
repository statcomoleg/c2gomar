import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { z } from 'zod';
import type { BotContext } from '../context';
import {
  resolveAudience,
  runBroadcast,
  type BroadcastAudience,
} from '../../services/broadcast';
import * as texts from '../texts';

type MyConversation = Conversation<BotContext, BotContext>;

export async function broadcastConversation(
  conversation: MyConversation,
  ctx: BotContext,
) {
  await ctx.reply(
    'Пришлите текст рассылки (HTML: <b>жирный</b>, <i>курсив</i>, <a href="url">ссылка</a>).\n' +
      'Можно прикрепить фото к тому же сообщению.',
  );

  const contentCtx = await conversation.waitFor('message');
  const msg = contentCtx.message;
  if (!msg) {
    await ctx.reply('Отмена.');
    return;
  }

  let text = msg.text || msg.caption || '';
  if (!text.trim()) {
    await ctx.reply('Нужен текст или подпись к фото. Отмена.');
    return;
  }

  // Сохраняем entities как HTML упрощённо: если есть caption/text entities — используем HTML из parse
  // Пользователь шлёт с parse_mode сам через форматирование клиента → entities есть.
  // Для простоты берём сырой текст; админ может слать HTML-теги вручную.
  const photoFileId = msg.photo?.at(-1)?.file_id;

  const audKb = new InlineKeyboard()
    .text('Все', 'bcast:all')
    .row()
    .text('Рейтинг выше N', 'bcast:gt')
    .text('Рейтинг ниже N', 'bcast:lt');

  await ctx.reply('Аудитория:', { reply_markup: audKb });
  const audCb = await conversation.waitFor('callback_query:data');
  await audCb.answerCallbackQuery();

  let audience: BroadcastAudience;
  const data = audCb.callbackQuery.data;
  if (data === 'bcast:all') {
    audience = { kind: 'all' };
  } else if (data === 'bcast:gt' || data === 'bcast:lt') {
    await ctx.reply('Введите порог N (целое число баллов):');
    const nCtx = await conversation.waitFor('message:text');
    const nParsed = z.coerce.number().int().safeParse(nCtx.message.text.trim());
    if (!nParsed.success) {
      await ctx.reply('Нужно целое число. Отмена.');
      return;
    }
    audience =
      data === 'bcast:gt'
        ? { kind: 'gt', n: nParsed.data }
        : { kind: 'lt', n: nParsed.data };
  } else {
    await ctx.reply('Отмена.');
    return;
  }

  const recipients = await conversation.external(() => resolveAudience(audience));
  const preview =
    `Превью:\n\n${text.slice(0, 500)}${text.length > 500 ? '…' : ''}\n\n` +
    `Получателей: ${recipients.length}` +
    (photoFileId ? '\n+ фото' : '');

  const confKb = new InlineKeyboard()
    .text('Подтвердить', 'bcast_yes')
    .text('Отмена', 'bcast_no');
  await ctx.reply(preview, { reply_markup: confKb, parse_mode: 'HTML' });

  const conf = await conversation.waitFor('callback_query:data');
  await conf.answerCallbackQuery();
  if (conf.callbackQuery.data !== 'bcast_yes') {
    await ctx.reply('Отменено.');
    return;
  }

  await ctx.reply('Рассылка запущена…');

  const adminChatId = ctx.chat!.id;
  const api = ctx.api;

  runBroadcast(
    api,
    audience,
    { text, parseMode: 'HTML', photoFileId },
    (result) => {
      void api.sendMessage(
        adminChatId,
        texts.broadcastReportText(result.success, result.total, result.failed),
      );
    },
  );
}
