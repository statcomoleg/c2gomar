import type { Message } from '@grammyjs/types';
import { tasksRepo } from '../db/repositories';
import type { Task } from '../types';

function channelMessageIdFromOrigin(message: Message): number | undefined {
  const origin = message.forward_origin;
  if (origin && origin.type === 'channel') return origin.message_id;
  return undefined;
}

function isChannelForward(message: Message): boolean {
  return Boolean(
    message.is_automatic_forward || channelMessageIdFromOrigin(message),
  );
}

/**
 * Поднимаемся по цепочке reply_to_message до корня треда.
 * Корневой пост discussion group — automatic forward из канала.
 */
export function resolveRootDiscussionMessageId(message: Message): number | null {
  let current: Message | undefined = message.reply_to_message;
  if (!current) return null;

  let guard = 0;
  while (current.reply_to_message && guard < 20) {
    if (isChannelForward(current)) break;
    current = current.reply_to_message;
    guard += 1;
  }

  return current.message_id;
}

export async function matchTaskByDiscussionMessage(
  discussionMessageId: number,
): Promise<Task | null> {
  return tasksRepo.findByDiscussionMessageId(discussionMessageId);
}

/**
 * Когда в discussion group появляется автофорвард поста канала —
 * проставляем discussion_message_id у задания.
 */
export async function tryBindDiscussionForward(message: Message): Promise<void> {
  const channelMsgId = channelMessageIdFromOrigin(message);
  if (!channelMsgId) return;
  if (!message.is_automatic_forward && !channelMsgId) return;

  const task = await tasksRepo.findTaskWithoutDiscussionByChannelMsg(channelMsgId);
  if (task) {
    await tasksRepo.setDiscussionMessageId(task.id, message.message_id);
    console.log(
      `[taskMatching] bound task=${task.id} discussion_message_id=${message.message_id}`,
    );
  }
}

/**
 * Fallback: если discussion_message_id ещё null, но комментарий — reply на автофорвард,
 * у которого origin.message_id = channel_message_id задания — биндим и матчим.
 */
export async function matchTaskWithFallback(message: Message): Promise<Task | null> {
  const rootId = resolveRootDiscussionMessageId(message);
  if (!rootId) return null;

  let task = await tasksRepo.findByDiscussionMessageId(rootId);
  if (task) return task;

  const root = findRootMessage(message);
  const channelMsgId = root ? channelMessageIdFromOrigin(root) : undefined;
  if (channelMsgId) {
    const byChannel = await tasksRepo.findByChannelMessageId(channelMsgId);
    if (byChannel) {
      if (!byChannel.discussion_message_id) {
        await tasksRepo.setDiscussionMessageId(byChannel.id, rootId);
      }
      return byChannel;
    }
  }
  return null;
}

function findRootMessage(message: Message): Message | undefined {
  let current: Message | undefined = message.reply_to_message;
  let guard = 0;
  while (current?.reply_to_message && guard < 20) {
    if (isChannelForward(current)) break;
    current = current.reply_to_message;
    guard += 1;
  }
  return current;
}
