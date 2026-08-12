import { formatInTimeZone } from 'date-fns-tz';

const TZ = process.env.TZ || 'Europe/Moscow';

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return formatInTimeZone(d, TZ, 'dd.MM.yyyy HH:mm');
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return formatInTimeZone(d, TZ, 'dd.MM.yyyy');
}

export function displayName(user: {
  username?: string | null;
  first_name?: string | null;
}): string {
  if (user.username) return `@${user.username}`;
  return user.first_name || 'Участник';
}
