import { InputFile, type Api } from 'grammy';
import path from 'path';
import { onboardingRepo, usersRepo, refSourcesRepo, settingsRepo } from '../db/repositories';
import { urlButtonKeyboard } from '../bot/keyboards';
import type { OnboardingMessage } from '../types';
import {
  hasJoinedChannel,
  sendMarathonMenu,
  sendNeedChannel,
} from '../bot/middleware/requireJoined';

function parseLocalPaths(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === 'string');
  } catch {
    return [];
  }
}

function resolveAsset(rel: string): InputFile {
  return new InputFile(path.resolve(process.cwd(), rel));
}

/** Без width/height Telegram (особенно iOS) часто рисует превью как 1:1 */
const VIDEO_META: Record<string, { width: number; height: number; duration: number }> = {
  'assets/onboarding/msg2.mp4': { width: 1280, height: 720, duration: 35 },
};

function videoSendOptions(relPath: string | null) {
  const meta = relPath ? VIDEO_META[relPath.replace(/\\/g, '/')] : undefined;
  return {
    supports_streaming: true as const,
    ...(meta ?? {}),
  };
}

/** Подставляем {{REF_URL}} и {{MARATHON_DATE}} в текст и button_url */
async function applyTemplates(
  text: string,
  buttonUrl: string | null,
  refUrl: string,
  marathonDate: string,
): Promise<{ text: string; buttonUrl: string | null }> {
  const replacedText = text
    .replace(/\{\{REF_URL\}\}/g, refUrl)
    .replace(/\{\{MARATHON_DATE\}\}/g, marathonDate);
  const replacedUrl = buttonUrl
    ? buttonUrl.replace(/\{\{REF_URL\}\}/g, refUrl).replace(/\{\{MARATHON_DATE\}\}/g, marathonDate)
    : null;
  return { text: replacedText, buttonUrl: replacedUrl };
}

/** Не блокируем event loop: планируем шаги через setTimeout */
export async function startOnboarding(api: Api, userId: number): Promise<void> {
  const messages = await onboardingRepo.listOnboardingMessages();
  if (messages.length === 0) {
    await sendNeedChannel(api, userId);
    await usersRepo.setOnboardingStep(userId, 1);
    return;
  }

  let cumulativeMs = 0;
  for (const msg of messages) {
    cumulativeMs += Math.max(0, msg.delay_seconds) * 1000;
    const step = msg.step_order;
    const captured = msg;
    setTimeout(() => {
      void sendOnboardingStep(api, userId, captured, step, messages.length);
    }, cumulativeMs);
  }
}

async function sendOnboardingStep(
  api: Api,
  userId: number,
  msg: OnboardingMessage,
  step: number,
  total: number,
): Promise<void> {
  try {
    // Получаем пользователя один раз для всех проверок и шаблонов
    const user = await usersRepo.findUserById(userId);

    // Шаги с only_if_not_joined не шлём после вступления
    if (msg.only_if_not_joined && user?.joined_channel_at) {
      console.log(`[onboarding] skip step=${step} user=${userId} already joined`);
      await usersRepo.setOnboardingStep(userId, step);
      return;
    }

    const settings = await settingsRepo.getSettings();
    const defaultRefUrl = settings?.default_ref_url ?? 'https://content2go.app/refH4kGr6DM';
    const refUrl = await refSourcesRepo.resolveRefUrl(user?.ref_code, defaultRefUrl);
    const marathonDate = user?.marathon_starts_at
      ? (() => {
          try {
            const d = new Date(user.marathon_starts_at);
            return (
              d.toLocaleString('ru-RU', {
                timeZone: 'Europe/Moscow',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              }) + ' (МСК)'
            );
          } catch {
            return 'послезавтра в 10:00 (МСК)';
          }
        })()
      : 'послезавтра в 10:00 (МСК)';

    const { text: resolvedText, buttonUrl: resolvedButtonUrl } = await applyTemplates(
      msg.text,
      msg.button_url,
      refUrl,
      marathonDate,
    );

    const replyMarkup =
      msg.button_text && resolvedButtonUrl
        ? urlButtonKeyboard(msg.button_text, resolvedButtonUrl)
        : undefined;

    const localPaths = parseLocalPaths(msg.local_media_paths);

    if (msg.media_type === 'video_note') {
      if (msg.media_file_id) {
        await api.sendVideoNote(userId, msg.media_file_id);
      }
      if (resolvedText) {
        await api.sendMessage(userId, resolvedText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: replyMarkup,
        });
      } else if (replyMarkup) {
        await api.sendMessage(userId, '👇', { reply_markup: replyMarkup });
      }
    } else if (msg.media_type === 'photo') {
      const media = msg.media_file_id || (localPaths[0] ? resolveAsset(localPaths[0]) : null);
      if (media) {
        await api.sendPhoto(userId, media);
      }
      await api.sendMessage(userId, resolvedText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
    } else if (msg.media_type === 'video') {
      const media = msg.media_file_id || (localPaths[0] ? resolveAsset(localPaths[0]) : null);
      if (media) {
        const sent = await api.sendVideo(userId, media, videoSendOptions(localPaths[0] ?? null));
        if (!msg.media_file_id && sent.video?.file_id) {
          try {
            await onboardingRepo.setOnboardingMedia(msg.id, 'video', sent.video.file_id);
          } catch (cacheErr) {
            console.warn(`[onboarding] failed to cache video file_id step=${step}`, cacheErr);
          }
        }
      }
      await api.sendMessage(userId, resolvedText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
    } else if (msg.media_type === 'media_group') {
      let fileIds: string[] = [];
      if (msg.media_file_id) {
        try {
          const parsed = JSON.parse(msg.media_file_id) as unknown;
          if (Array.isArray(parsed)) fileIds = parsed.filter((x): x is string => typeof x === 'string');
        } catch {
          /* ignore */
        }
      }
      if (fileIds.length >= 2) {
        await api.sendMediaGroup(
          userId,
          fileIds.map((id) => ({ type: 'photo' as const, media: id })),
        );
      } else if (localPaths.length >= 2) {
        await api.sendMediaGroup(
          userId,
          localPaths.map((p) => ({ type: 'photo' as const, media: resolveAsset(p) })),
        );
      } else if (localPaths.length === 1) {
        await api.sendPhoto(userId, resolveAsset(localPaths[0]));
      }
      await api.sendMessage(userId, resolvedText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
    } else {
      await api.sendMessage(userId, resolvedText, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
    }

    await usersRepo.setOnboardingStep(userId, step);

    if (step >= total) {
      // Меню марафона — только после вступления в канал
      if (await hasJoinedChannel(userId)) {
        await sendMarathonMenu(api, userId);
      } else {
        await sendNeedChannel(api, userId);
      }
    }
  } catch (err) {
    console.error(`[onboarding] user=${userId} step=${step}`, err);
  }
}
