import { Keyboard, InlineKeyboard } from 'grammy';
import type { OnboardingMessage, Task } from '../../types';

export function userMainKeyboard(): Keyboard {
  return new Keyboard()
    .text('Мои задания')
    .text('Рейтинг')
    .resized()
    .persistent();
}

/** Убрать reply-клавиатуру марафона (пока нет доступа) */
export function removeUserKeyboard(): { remove_keyboard: true } {
  return { remove_keyboard: true };
}

export function adminMainKeyboard(): Keyboard {
  return new Keyboard()
    .text('Начислить')
    .text('Добавить задание')
    .row()
    .text('Рассылка')
    .text('Онбординг')
    .resized()
    .persistent();
}

export function tasksListKeyboard(
  tasks: Task[],
  approvedTaskIds: Set<number>,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const t of tasks) {
    const mark = approvedTaskIds.has(t.id) ? '✅' : '▫️';
    kb.text(`${mark} ${t.label}`, `task:${t.id}`).row();
  }
  return kb;
}

export function submissionReviewKeyboard(submissionId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔁 На доработку', `review:${submissionId}:reject`)
    .text('+3 балла', `review:${submissionId}:3`)
    .text('+10 баллов', `review:${submissionId}:10`);
}

export function confirmKeyboard(yes = 'confirm_yes', no = 'confirm_no'): InlineKeyboard {
  return new InlineKeyboard().text('Подтвердить', yes).text('Отмена', no);
}

export function taskTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('ПДЗ', 'task_type:pre').text('ДЗ', 'task_type:main');
}

export function broadcastAudienceKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Все', 'bcast:all')
    .row()
    .text('Рейтинг выше N', 'bcast:gt')
    .text('Рейтинг ниже N', 'bcast:lt');
}

export function urlButtonKeyboard(text: string, url: string): InlineKeyboard {
  return new InlineKeyboard().url(text, url);
}

export function onboardingStepKeyboard(messages: OnboardingMessage[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const m of messages) {
    kb.text(`Шаг ${m.step_order}`, `ob:edit:${m.id}`).row();
  }
  kb.text('💾 Сохранить кружок', 'ob:save_circle');
  return kb;
}

export function onboardingEditKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('Изменить текст', `ob:text:${id}`)
    .row()
    .text('Изменить задержку', `ob:delay:${id}`)
    .row()
    .text('« Назад', 'ob:list');
}
