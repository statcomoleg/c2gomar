/**
 * 1. Обновляет discussion_group_id на группу @content2go
 * 2. Сканирует комментарии и подтягивает пропущенные submissions
 *
 * Запуск: npx tsx scripts/backfill-submissions.ts
 *
 * ВАЖНО: бот должен быть админом в группе обсуждений канала @content2go
 */
import 'dotenv/config';
import { Bot } from 'grammy';
import type { Message } from '@grammyjs/types';
import { getSupabase } from '../src/db/client';
import { submissionsRepo, tasksRepo, usersRepo } from '../src/db/repositories';
import { extractSubmissionMedia } from '../src/services/submissionMedia';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_IDS!.split(',')[0].trim());

const NEW_DISCUSSION_GROUP_ID = -1004396739025;
const CHANNEL_ID = -1003877739897;
const SCAN_MAX_MSG_ID = 3000;
const DELAY_MS = 35;

const bot = new Bot(BOT_TOKEN);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function channelMsgIdFromMessage(msg: Message): number | null {
  const origin = msg.forward_origin;
  if (origin?.type === 'channel') return origin.message_id;
  return null;
}

function isUserComment(msg: Message): boolean {
  return Boolean(msg.from && !msg.from.is_bot && !msg.sender_chat);
}

async function forwardSafe(
  fromChatId: number,
  messageId: number,
): Promise<Message | null> {
  try {
    return await bot.api.forwardMessage(ADMIN_ID, fromChatId, messageId);
  } catch {
    return null;
  }
}

async function deleteSafe(chatId: number, messageId: number) {
  try {
    await bot.api.deleteMessage(chatId, messageId);
  } catch {
    /* ignore */
  }
}

async function ensureBotInGroup(): Promise<void> {
  const me = await bot.api.getMe();
  try {
    const member = await bot.api.getChatMember(NEW_DISCUSSION_GROUP_ID, me.id);
    if (member.status === 'left' || member.status === 'kicked') {
      throw new Error('not member');
    }
    console.log(`✅ Бот в группе обсуждений (status: ${member.status})`);
  } catch {
    throw new Error(
      `Бот НЕ в группе обсуждений @content2go (id ${NEW_DISCUSSION_GROUP_ID}).\n` +
        `Добавьте @${me.username} админом в группу комментариев канала и запустите скрипт снова.`,
    );
  }
}

async function updateSettings() {
  const sb = getSupabase();
  const { error } = await sb
    .from('app_settings')
    .update({
      channel_id: CHANNEL_ID,
      discussion_group_id: NEW_DISCUSSION_GROUP_ID,
    })
    .eq('id', true);
  if (error) throw error;
  console.log(`✅ app_settings: discussion_group_id → ${NEW_DISCUSSION_GROUP_ID}`);
}

async function scanChannelForwards(
  channelMsgIds: number[],
): Promise<Map<number, number>> {
  /** channel_message_id → discussion_message_id */
  const bindings = new Map<number, number>();
  console.log(`\nСканируем автофорварды постов (1..${SCAN_MAX_MSG_ID})...`);

  for (let msgId = 1; msgId <= SCAN_MAX_MSG_ID; msgId++) {
    const fwd = await forwardSafe(NEW_DISCUSSION_GROUP_ID, msgId);
    if (fwd) {
      const channelMsgId = channelMsgIdFromMessage(fwd);
      if (channelMsgId && channelMsgIds.includes(channelMsgId)) {
        bindings.set(channelMsgId, msgId);
        console.log(`  📌 post /${channelMsgId} → discussion msg ${msgId}`);
      }
      await deleteSafe(ADMIN_ID, fwd.message_id);
    }
    if (msgId % 200 === 0) console.log(`  ...${msgId}`);
    await sleep(DELAY_MS);
  }

  return bindings;
}

async function bindTasks(bindings: Map<number, number>) {
  for (const [channelMsgId, discussionMsgId] of bindings) {
    const task = await tasksRepo.findByChannelMessageId(channelMsgId);
    if (!task) continue;
    await tasksRepo.setDiscussionMessageId(task.id, discussionMsgId);
    console.log(`  ✅ task ${task.label} (id=${task.id}) bound`);
  }
}

async function scanComments(
  bindings: Map<number, number>,
): Promise<number> {
  /** discussion root msg id → task id */
  const rootToTask = new Map<number, number>();
  for (const [channelMsgId, discussionMsgId] of bindings) {
    const task = await tasksRepo.findByChannelMessageId(channelMsgId);
    if (task) rootToTask.set(discussionMsgId, task.id);
  }

  /** discussion root msg id → forwarded msg id in admin chat */
  const rootInAdmin = new Map<number, number>();

  // Сначала форвардим корневые посты в админ-чат и запоминаем их id
  for (const [channelMsgId, discussionMsgId] of bindings) {
    const fwd = await forwardSafe(NEW_DISCUSSION_GROUP_ID, discussionMsgId);
    if (fwd) {
      rootInAdmin.set(discussionMsgId, fwd.message_id);
    }
    await sleep(DELAY_MS);
  }

  const adminRootIds = new Set(rootInAdmin.values());
  const adminRootToTask = new Map<number, number>();
  for (const [discussionMsgId, taskId] of rootToTask) {
    const adminMsgId = rootInAdmin.get(discussionMsgId);
    if (adminMsgId) adminRootToTask.set(adminMsgId, taskId);
  }

  let created = 0;
  console.log(`\nСканируем комментарии участников...`);

  for (let msgId = 1; msgId <= SCAN_MAX_MSG_ID; msgId++) {
    const fwd = await forwardSafe(NEW_DISCUSSION_GROUP_ID, msgId);
    if (!fwd || !isUserComment(fwd)) {
      if (fwd) await deleteSafe(ADMIN_ID, fwd.message_id);
      await sleep(DELAY_MS);
      continue;
    }

    const replyRootId = fwd.reply_to_message?.message_id;
    if (!replyRootId || !adminRootToTask.has(replyRootId)) {
      await deleteSafe(ADMIN_ID, fwd.message_id);
      await sleep(DELAY_MS);
      continue;
    }

    const taskId = adminRootToTask.get(replyRootId)!;
    const userId = fwd.from!.id;
    const commentText = fwd.text || fwd.caption || '[медиа без текста]';

    await usersRepo.upsertUserProfile({
      id: userId,
      username: fwd.from!.username,
      first_name: fwd.from!.first_name,
    });

    const active = await submissionsRepo.findActiveForUserTask(userId, taskId);
    if (active?.status === 'approved') {
      await deleteSafe(ADMIN_ID, fwd.message_id);
      await sleep(DELAY_MS);
      continue;
    }
    if (active?.status === 'pending') {
      await submissionsRepo.markSuperseded(active.id);
    }

    const media = extractSubmissionMedia(fwd);

    await submissionsRepo.createSubmission({
      task_id: taskId,
      user_id: userId,
      comment_message_id: msgId,
      comment_text: commentText,
      media_type: media?.media_type ?? null,
      media_file_id: media?.media_file_id ?? null,
    });

    const task = await tasksRepo.getTaskById(taskId);
    console.log(
      `  ✅ submission: user=${userId} task=${task?.label} msg=${msgId}`,
    );
    created++;

    await deleteSafe(ADMIN_ID, fwd.message_id);
    await sleep(DELAY_MS);
  }

  // Удаляем корневые форварды из админ-чата
  for (const adminMsgId of adminRootIds) {
    await deleteSafe(ADMIN_ID, adminMsgId);
  }

  return created;
}

async function main() {
  await ensureBotInGroup();
  await updateSettings();

  const sb = getSupabase();
  const { data: tasks } = await sb
    .from('tasks')
    .select('id, label, channel_message_id, is_active')
    .eq('is_active', true);

  const channelMsgIds = (tasks ?? []).map((t) => t.channel_message_id as number);
  console.log(`Активных заданий: ${channelMsgIds.length}`, channelMsgIds);

  const bindings = await scanChannelForwards(channelMsgIds);
  if (bindings.size === 0) {
    console.warn('Не найдено автофорвардов постов. Проверьте, что посты есть в канале.');
  }

  await bindTasks(bindings);
  const created = await scanComments(bindings);

  console.log(`\n🎉 Готово. Создано submissions: ${created}`);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
