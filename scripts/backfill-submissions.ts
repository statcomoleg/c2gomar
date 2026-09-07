/**
 * Подтягивает пропущенные submissions из группы обсуждений @content2go.
 * Логика как в discussionComment.ts: только reply на автофорвард поста задания.
 */
import 'dotenv/config';
import { Bot } from 'grammy';
import type { Message } from '@grammyjs/types';
import { getSupabase } from '../src/db/client';
import { submissionsRepo, tasksRepo, usersRepo } from '../src/db/repositories';
import { extractSubmissionMedia } from '../src/services/submissionMedia';
import {
  resolveRootDiscussionMessageId,
  matchTaskByDiscussionMessage,
} from '../src/services/taskMatching';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const DISCUSSION_GROUP_ID = -1004396739025;
const STAGING_CHAT_ID = -1004302931100;
const SCAN_MAX_MSG_ID = 800;
const DELAY_MS = 80;

const bot = new Bot(BOT_TOKEN);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isChannelForward(msg: Message): boolean {
  return msg.forward_origin?.type === 'channel' || Boolean(msg.is_automatic_forward);
}

function channelMessageIdFromOrigin(message: Message): number | undefined {
  const origin = message.forward_origin;
  if (origin?.type === 'channel') return origin.message_id;
  return undefined;
}

function getAuthor(msg: Message): {
  id: number;
  username?: string;
  first_name?: string;
} | null {
  if (msg.from && !msg.from.is_bot) {
    return {
      id: msg.from.id,
      username: msg.from.username,
      first_name: msg.from.first_name,
    };
  }
  const origin = msg.forward_origin;
  if (origin?.type === 'user') {
    const u = origin.sender_user;
    if (!u.is_bot) {
      return { id: u.id, username: u.username, first_name: u.first_name };
    }
  }
  if (msg.forward_from && !msg.forward_from.is_bot) {
    return {
      id: msg.forward_from.id,
      username: msg.forward_from.username,
      first_name: msg.forward_from.first_name,
    };
  }
  return null;
}

function isUserComment(msg: Message): boolean {
  return getAuthor(msg) !== null && !isChannelForward(msg);
}

/** reply / external_reply → discussion_message_id корня задания */
function resolveTaskDiscussionRoot(
  msg: Message,
  discussionRoots: Set<number>,
  channelToDiscussion: Map<number, number>,
): number | null {
  const fromChain = resolveRootDiscussionMessageId(msg);
  if (fromChain && discussionRoots.has(fromChain)) return fromChain;

  const direct = msg.reply_to_message?.message_id;
  if (direct && discussionRoots.has(direct)) return direct;

  const ext = msg.external_reply as
    | { origin?: { type?: string; message_id?: number } }
    | undefined;
  if (ext?.origin?.type === 'channel' && ext.origin.message_id) {
    const disc = channelToDiscussion.get(ext.origin.message_id);
    if (disc) return disc;
  }

  let current = msg.reply_to_message;
  let guard = 0;
  while (current && guard < 20) {
    if (discussionRoots.has(current.message_id)) return current.message_id;
    const chId = channelMessageIdFromOrigin(current);
    if (chId) {
      const disc = channelToDiscussion.get(chId);
      if (disc) return disc;
    }
    current = current.reply_to_message;
    guard += 1;
  }

  return null;
}

async function forwardWithRetry(
  messageId: number,
  retries = 5,
): Promise<Message | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await bot.api.forwardMessage(
        STAGING_CHAT_ID,
        DISCUSSION_GROUP_ID,
        messageId,
      );
    } catch (e: unknown) {
      const err = e as { error_code?: number; parameters?: { retry_after?: number } };
      if (err.error_code === 429 && attempt < retries) {
        const wait = (err.parameters?.retry_after ?? 30) + 2;
        console.log(`  ⏳ rate limit, ждём ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function deleteFromStaging(messageId: number) {
  try {
    await bot.api.deleteMessage(STAGING_CHAT_ID, messageId);
  } catch {
    /* ignore */
  }
}

async function loadBindings(): Promise<{
  channelToDiscussion: Map<number, number>;
  discussionRoots: Set<number>;
}> {
  const sb = getSupabase();
  const { data: tasks } = await sb
    .from('tasks')
    .select('channel_message_id, discussion_message_id')
    .eq('is_active', true)
    .not('discussion_message_id', 'is', null);

  const channelToDiscussion = new Map<number, number>();
  const discussionRoots = new Set<number>();
  for (const t of tasks ?? []) {
    channelToDiscussion.set(
      t.channel_message_id as number,
      t.discussion_message_id as number,
    );
    discussionRoots.add(t.discussion_message_id as number);
  }
  return { channelToDiscussion, discussionRoots };
}

async function main() {
  const me = await bot.api.getMe();
  await bot.api.getChatMember(DISCUSSION_GROUP_ID, me.id);
  console.log('✅ Бот в группе @content2go');

  const { channelToDiscussion, discussionRoots } = await loadBindings();
  console.log('Корни заданий:', [...discussionRoots].sort((a, b) => a - b));

  const existingMsgIds = new Set<number>();
  const sb = getSupabase();
  const { data: existing } = await sb
    .from('submissions')
    .select('comment_message_id');
  for (const row of existing ?? []) {
    if (row.comment_message_id) existingMsgIds.add(row.comment_message_id);
  }

  let created = 0;
  let scanned = 0;
  let userComments = 0;
  let matched = 0;
  const perTask = new Map<number, number>();

  console.log(`Сканируем 1..${SCAN_MAX_MSG_ID} (только reply на посты заданий)...`);

  for (let msgId = 1; msgId <= SCAN_MAX_MSG_ID; msgId++) {
    const fwd = await forwardWithRetry(msgId);
    if (!fwd) {
      await sleep(DELAY_MS);
      continue;
    }
    scanned++;

    if (isUserComment(fwd)) {
      userComments++;
      const rootId = resolveTaskDiscussionRoot(
        fwd,
        discussionRoots,
        channelToDiscussion,
      );

      if (rootId) {
        matched++;
        const task = await matchTaskByDiscussionMessage(rootId);
        const author = getAuthor(fwd);

        if (task && author && !existingMsgIds.has(msgId)) {
          await usersRepo.upsertUserProfile({
            id: author.id,
            username: author.username,
            first_name: author.first_name,
          });

          const active = await submissionsRepo.findActiveForUserTask(
            author.id,
            task.id,
          );
          if (active?.status === 'approved') {
            /* skip */
          } else {
            if (active?.status === 'pending') {
              await submissionsRepo.markSuperseded(active.id);
            }

            const media = extractSubmissionMedia(fwd);
            await submissionsRepo.createSubmission({
              task_id: task.id,
              user_id: author.id,
              comment_message_id: msgId,
              comment_text: fwd.text || fwd.caption || '[медиа без текста]',
              media_type: media?.media_type ?? null,
              media_file_id: media?.media_file_id ?? null,
            });

            perTask.set(task.id, (perTask.get(task.id) ?? 0) + 1);
            console.log(
              `  ✅ @${author.username ?? author.id} → ${task.label} (msg ${msgId}, root ${rootId})`,
            );
            created++;
            existingMsgIds.add(msgId);
          }
        } else if (task && author) {
          console.log(
            `  ⏭ уже есть: @${author.username ?? author.id} → ${task.label} (msg ${msgId})`,
          );
        }
      }
    }

    await deleteFromStaging(fwd.message_id);
    if (msgId % 100 === 0) console.log(`  ...${msgId} (user=${userComments}, match=${matched})`);
    await sleep(DELAY_MS);
  }

  console.log(`\nПросканировано: ${scanned}, user-комментариев: ${userComments}, reply на задания: ${matched}`);
  console.log('По заданиям:', Object.fromEntries(perTask));
  console.log(`🎉 Создано submissions: ${created}`);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
