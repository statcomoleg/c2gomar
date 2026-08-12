import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { adminsRepo } from '../../db/repositories';

export const isAdminMiddleware = new Composer<BotContext>();

/** Помечает ctx.isAdmin; не режет апдейты — режет admin-роуты отдельно */
isAdminMiddleware.use(async (ctx, next) => {
  const id = ctx.from?.id;
  ctx.isAdmin = id ? await adminsRepo.isAdmin(id) : false;
  await next();
});

/** Жёсткая проверка: не-админ — молча игнор */
export async function requireAdmin(ctx: BotContext, next: () => Promise<void>) {
  if (!ctx.isAdmin) return;
  await next();
}
