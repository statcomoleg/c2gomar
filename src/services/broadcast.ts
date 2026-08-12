import type { Api } from 'grammy';
import { InputFile } from 'grammy';
import { usersRepo } from '../db/repositories';

const DELAY_MS = 35; // ~28 msg/sec — безопасный запас от лимита Telegram

export type BroadcastAudience =
  | { kind: 'all' }
  | { kind: 'gt'; n: number }
  | { kind: 'lt'; n: number };

export type BroadcastPayload = {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  photoFileId?: string;
  /** Локальный файл (админка): загрузится один раз, дальше — file_id */
  photoBuffer?: Buffer;
  photoFilename?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function resolveAudience(audience: BroadcastAudience): Promise<number[]> {
  if (audience.kind === 'all') return usersRepo.listAllUserIds();
  if (audience.kind === 'gt') return usersRepo.listUserIdsByPoints('gt', audience.n);
  return usersRepo.listUserIdsByPoints('lt', audience.n);
}

/**
 * Рассылка в фоне: не блокирует обработку апдейтов.
 */
export function runBroadcast(
  api: Api,
  audience: BroadcastAudience,
  payload: BroadcastPayload,
  onDone: (result: { success: number; total: number; failed: number }) => void,
): void {
  void (async () => {
    const ids = await resolveAudience(audience);
    let success = 0;
    let failed = 0;
    let photoFileId = payload.photoFileId;
    const hasPhoto = Boolean(photoFileId || payload.photoBuffer);

    for (const id of ids) {
      try {
        if (hasPhoto) {
          const media =
            photoFileId ||
            new InputFile(
              payload.photoBuffer!,
              payload.photoFilename || 'photo.jpg',
            );
          const sent = await api.sendPhoto(id, media, {
            caption: payload.text,
            parse_mode: payload.parseMode ?? 'HTML',
          });
          if (!photoFileId && sent.photo?.length) {
            photoFileId = sent.photo[sent.photo.length - 1]?.file_id;
          }
        } else {
          await api.sendMessage(id, payload.text, {
            parse_mode: payload.parseMode ?? 'HTML',
            link_preview_options: { is_disabled: true },
          });
        }
        success += 1;
      } catch (err) {
        failed += 1;
        console.error(`[broadcast] fail user=${id}`, err);
      }
      await sleep(DELAY_MS);
    }

    onDone({ success, total: ids.length, failed });
  })();
}
