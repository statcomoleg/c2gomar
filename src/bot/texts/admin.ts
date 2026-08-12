import { displayName } from './format';
import type { OnboardingMessage, Task } from '../../types';

export function adminMenuText(): string {
  return 'Панель админа. Выберите действие:';
}

export function submissionCardText(params: {
  task: Task;
  username: string | null;
  firstName: string | null;
  commentText: string;
}): string {
  const who = displayName({
    username: params.username,
    first_name: params.firstName,
  });
  return (
    `📝 Новый отчёт\n` +
    `Задание: ${params.task.label} — ${params.task.description}\n` +
    `От: ${who}\n` +
    `Текст:\n${params.commentText}`
  );
}

export function submissionProcessedText(
  adminUsername: string,
  result: string,
): string {
  return `\n\n✅ Обработано: ${adminUsername}, решение: ${result}`;
}

export function alreadyProcessedText(adminName: string): string {
  return `Уже обработано пользователем ${adminName}`;
}

export function taskExistsText(label: string): string {
  return `Это задание уже существует: ${label}`;
}

export function taskCreatedText(task: Task): string {
  return (
    `Задание создано.\n` +
    `${task.label} (${task.type === 'pre' ? 'ПДЗ' : 'ДЗ'})\n` +
    `${task.description}\n` +
    `${task.channel_post_link}\n` +
    `channel_message_id: ${task.channel_message_id}`
  );
}

export function invalidPostLinkText(): string {
  return (
    'Неверный формат ссылки. Пример:\n' +
    'https://t.me/c/1234567890/42\n' +
    'или https://t.me/channelname/42'
  );
}

export function broadcastReportText(success: number, total: number, failed: number): string {
  return `Разослано: ${success}/${total}, ошибок: ${failed}`;
}

export function awardConfirmText(
  points: number,
  username: string,
  id: number,
): string {
  return `Начислить ${points} баллов пользователю ${username} (id ${id})?`;
}

export function onboardingListText(messages: OnboardingMessage[]): string {
  if (messages.length === 0) return 'Цепочка пуста.';
  return (
    'Шаги онбординга:\n\n' +
    messages
      .map((m) => {
        const media =
          m.media_type === 'video_note'
            ? m.media_file_id
              ? ' [кружок ✓]'
              : ' [кружок — нет file_id]'
            : m.media_type
              ? ` [${m.media_type}]`
              : '';
        const preview = m.text.replace(/<[^>]+>/g, '').slice(0, 80);
        return `${m.step_order}. id=${m.id}, delay=${m.delay_seconds}с${media}\n${preview}…`;
      })
      .join('\n\n')
  );
}

export function saveCircleHelpText(): string {
  return (
    'Перешлите боту video-кружок (video note).\n' +
    'Он сохранится в шаг онбординга с типом video_note.\n' +
    'Либо ответьте кружком на это сообщение.'
  );
}

export function circleSavedText(stepOrder: number): string {
  return `Кружок сохранён для шага ${stepOrder} онбординга.`;
}

export function settingsMissingText(): string {
  return (
    'В app_settings нет строки или стоят плейсхолдер channel_id. ' +
    'Заполните channel_id, discussion_group_id и marathon_start_at перед запуском.'
  );
}

export function debugChatIdText(chatId: number, type: string): string {
  return `chat_id: ${chatId}\ntype: ${type}`;
}
