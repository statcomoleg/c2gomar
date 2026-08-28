/**
 * Общая логика обработки вступления участника в канал.
 * Вызывается из joinRequestHandler (chat_join_request) и из
 * callback-хендлера кнопки «Стать участником».
 */
import { InputFile, type Api } from 'grammy';
import path from 'path';
import { usersRepo, settingsRepo, refSourcesRepo } from '../db/repositories';
import { userMainKeyboard } from '../bot/keyboards';
import * as texts from '../bot/texts';

const MENU_IMAGE = path.resolve(process.cwd(), 'assets/onboarding/menu_practicum.png');
const FALLBACK_INVITE = 'https://t.me/content2go';

export interface JoinFlowResult {
  /** false — пользователь уже был участником, повторная обработка не нужна */
  alreadyJoined: boolean;
}

export async function processJoin(
  api: Api,
  userId: number,
  fromInfo: { username?: string | null; first_name?: string | null },
): Promise<JoinFlowResult> {
  // Проверяем — не вступил ли уже
  const existing = await usersRepo.findUserById(userId);
  if (existing?.joined_channel_at) {
    return { alreadyJoined: true };
  }

  // Убеждаемся, что пользователь есть в БД
  if (!existing) {
    await usersRepo.createUser({
      id: userId,
      username: fromInfo.username,
      first_name: fromInfo.first_name,
    });
  } else {
    await usersRepo.upsertUserProfile({
      id: userId,
      username: fromInfo.username,
      first_name: fromInfo.first_name,
    });
  }

  const user = await usersRepo.markJoinedChannel(userId);

  // Инкремент joins у источника трафика
  if (user.ref_code) {
    await refSourcesRepo.incrementJoins(user.ref_code).catch(() => {});
  }

  const settings = await settingsRepo.getSettings();
  const defaultRefUrl = settings?.default_ref_url ?? 'https://content2go.app/refH4kGr6DM';
  const refUrl = await refSourcesRepo.resolveRefUrl(user.ref_code, defaultRefUrl);
  const invite = settings?.channel_invite_link ?? FALLBACK_INVITE;

  const marathonDate = user.marathon_starts_at
    ? texts.formatMarathonDate(user.marathon_starts_at)
    : 'послезавтра в 10:00 (МСК)';

  try {
    await api.sendPhoto(userId, new InputFile(MENU_IMAGE));
    await api.sendMessage(userId, texts.channelOpenedText(invite, refUrl, marathonDate), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: userMainKeyboard(),
    });
  } catch (err) {
    console.error('[joinFlow] notify user failed', err);
  }

  return { alreadyJoined: false };
}
