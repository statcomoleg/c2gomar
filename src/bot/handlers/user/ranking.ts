import { Composer } from 'grammy';
import type { BotContext } from '../../context';
import { getTop10, getUserRank } from '../../../services/ranking';
import * as texts from '../../texts';
import { requireJoinedChannel } from '../../middleware/requireJoined';

export const rankingHandler = new Composer<BotContext>();

rankingHandler.hears('Рейтинг', requireJoinedChannel, async (ctx) => {
  if (!ctx.from) return;
  const [top, me] = await Promise.all([getTop10(), getUserRank(ctx.from.id)]);
  await ctx.reply(
    texts.rankingText({
      myRank: me.rank,
      myPoints: me.total_points,
      top,
    }),
  );
});
