import { displayName, formatDate } from './format';
import type { RankedUser, Submission, Task } from '../../types';

export function welcomeBackText(): string {
  return 'Снова привет! Выберите действие в меню ниже.';
}

export function welcomeBackNeedChannelText(): string {
  return (
    'Снова привет!\n\n' +
    'Меню марафона откроется после вступления в закрытый канал практикума.'
  );
}

export function marathonMenuText(): string {
  return 'Меню марафона:';
}

export function needChannelText(): string {
  return (
    'Функции марафона пока недоступны.\n\n' +
    'Сначала вступите в закрытый канал практикума — после одобрения заявки откроются «Мои задания» и «Рейтинг».'
  );
}

export function joinChannelHintText(): string {
  return 'Нажмите кнопку ниже, подайте заявку — бот примет её автоматически.';
}

export function channelOpenedText(channelLink: string): string {
  return (
    `🎉 <b>Поздравляем! Вы зарегистрированы на практикум!</b>\n\n` +
    `Мы <b>стартуем 17 августа</b>. Это понятные инструкции и простые задания — выполнив их, вы уже разберётесь, как создавать контент-заводы для себя и для других за хорошие чеки.\n\n` +
    `✅ Выполняйте задания и получайте баллы. Потом их можно обменять на подарки от нашей ` +
    `<a href="https://content2go.app/refH4kGr6DM">платформы</a> и на доступ в закрытое коммьюнити креаторов, которые уже успешно зарабатывают на контент-заводах.\n\n` +
    `📅 До 17 августа на канале вас ждут предварительные задания — за них тоже будут дополнительные баллы:\n` +
    `${channelLink}\n\n` +
    `📌 Чтобы проверить актуальные задания, нажмите <b>«Мои задания»</b>.\n` +
    `🏆 Чтобы узнать, сколько баллов вы уже заработали и какое у вас место в рейтинге, нажмите <b>«Рейтинг»</b>.`
  );
}

export function noTasksText(): string {
  return 'Пока нет доступных заданий, следите за постами в канале.';
}

export function taskStatusLabel(sub: Submission | null): string {
  if (!sub) return 'Не начато';
  if (sub.status === 'pending') return 'На проверке';
  if (sub.status === 'approved') {
    const pts = sub.points_awarded ?? 0;
    return `Одобрено, +${pts} баллов`;
  }
  if (sub.status === 'rejected') {
    const fb = sub.admin_feedback ? `\nКомментарий куратора: ${sub.admin_feedback}` : '';
    return `Отправлено на доработку${fb}`;
  }
  return 'Не начато';
}

export function taskDetailText(task: Task, sub: Submission | null): string {
  return (
    `<b>${task.label}</b>\n` +
    `${task.description}\n\n` +
    `Пост: ${task.channel_post_link}\n` +
    `Статус: ${taskStatusLabel(sub)}`
  );
}

export function rankingText(params: {
  myRank: number;
  myPoints: number;
  top: RankedUser[];
}): string {
  const lines = params.top.map((u, i) => {
    const name = displayName(u);
    return `${i + 1}. ${name} — ${u.total_points}`;
  });
  return (
    `🏆 Рейтинг марафона\n\n` +
    `Ваше место: #${params.myRank} — ${params.myPoints} баллов\n\n` +
    (lines.length ? lines.join('\n') : 'Пока никого в рейтинге.')
  );
}

export function taskApprovedText(label: string, points: number, total: number): string {
  return `✅ Задание ${label} принято! Начислено +${points} баллов. Ваш баланс: ${total}.`;
}

export function taskRejectedText(label: string): string {
  return (
    `🔁 Задание ${label} отправлено на доработку. ` +
    `Проверьте комментарии куратора и пришлите исправленный отчёт под тем же постом.`
  );
}

export function preTasksClosedText(): string {
  return 'Приём предварительных заданий завершён, этот тип заданий больше не засчитывается.';
}

export function mainTasksNotOpenText(startAt: string): string {
  return `Основные задания открываются после старта марафона ${formatDate(startAt)}.`;
}

export function alreadyApprovedText(): string {
  return 'Это задание уже одобрено ✅';
}

export function manualPointsText(points: number, total: number): string {
  return `💰 Вам начислено ${points} баллов админом. Баланс: ${total}.`;
}

export function submissionReceivedText(): string {
  return 'Отчёт принят и отправлен на проверку куратору. Обычно ответ приходит в течение дня.';
}
