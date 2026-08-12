import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor } from '@grammyjs/conversations';

export type SessionData = {
  awaitingCircle?: boolean;
  editOnboardingId?: number;
  editOnboardingField?: 'text' | 'delay';
};

type BaseContext = Context &
  SessionFlavor<SessionData> & {
    isAdmin: boolean;
  };

export type BotContext = ConversationFlavor<BaseContext>;
