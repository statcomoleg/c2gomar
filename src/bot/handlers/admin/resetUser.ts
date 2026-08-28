/**
 * Секретный сброс — только для пользователей из таблицы admins.
 * Отправь боту: RESET_2323545464235211
 * Удаляет все данные отправителя → можно заново пройти онбординг как новый.
 */
import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { getSupabase } from '../../../db/client';

const SECRET = 'RESET_2323545464235211';

export const resetUserHandler = new Composer<BotContext>();

resetUserHandler.on('message:text', async (ctx, next) => {
  if (ctx.message.text.trim() !== SECRET) return next();
  if (!ctx.from) return next();

  // Только для админов
  if (!ctx.isAdmin) {
    return next();
  }

  const userId = ctx.from.id;
  const sb = getSupabase();

  try {
    // Удаляем в порядке зависимостей (FK cascade должен сам, но на всякий случай явно)
    await sb.from('promo_code_uses').delete().eq('user_id', userId);
    await sb.from('points_ledger').delete().eq('user_id', userId);
    await sb.from('submissions').delete().eq('user_id', userId);
    await sb.from('users').delete().eq('id', userId);

    await ctx.reply(
      `✅ Готово! Твои данные удалены.\n\nТеперь отправь /start — пройдёшь онбординг как новый пользователь.`,
    );
  } catch (err) {
    console.error('[resetUser] error:', err);
    await ctx.reply(`❌ Ошибка при сбросе: ${String(err)}`);
  }
});
