import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { promoCodesRepo } from '../../../db/repositories';
import { awardPoints } from '../../../services/points';
import * as texts from '../../texts';

export const promoCodeHandler = new Composer<BotContext>();

/**
 * Слушаем любое текстовое сообщение из одного слова (без пробелов).
 * Если оно совпадает с активным промо-кодом — начисляем баллы.
 */
promoCodeHandler.on('message:text', async (ctx, next) => {
  if (!ctx.from) return next();

  const text = ctx.message.text.trim();

  // Только одно слово без пробелов; команды и кнопки меню уже обработаны до этого
  if (!text || /\s/.test(text) || text.startsWith('/')) return next();

  let code;
  try {
    code = await promoCodesRepo.findRedeemable(text);
  } catch {
    return next();
  }

  if (!code) return next();

  // Пробуем зафиксировать использование
  let ok: boolean;
  try {
    ok = await promoCodesRepo.redeemCode(code.id, ctx.from.id);
    if (ok) await promoCodesRepo.incrementUsedCount(code.id);
  } catch {
    return next();
  }

  if (!ok) {
    await ctx.reply(texts.promoCodeAlreadyUsedText(), { parse_mode: 'HTML' });
    return;
  }

  const { newTotal } = await awardPoints({
    userId: ctx.from.id,
    points: code.points,
    reason: `promo:${code.code}`,
    adminId: null,
  });

  await ctx.reply(texts.promoCodeSuccessText(code.points, newTotal), {
    parse_mode: 'HTML',
  });
});
