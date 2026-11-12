// Texts of states and priorities and dates as people say them: Dnes, Zítra, včera v 17:12.
import type { Priority, Status } from './api';

export const STATUS: Record<Status, string> = { open: 'Otevřený', progress: 'V řešení', closed: 'Uzavřený' };
export const PRIORITY: Record<Priority, string> = { high: 'Vysoká', medium: 'Střední', low: 'Nízká' };

const DAY = 86_400_000;

/** Days from today to a date YYYY-MM-DD: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFrom(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const today = new Date();
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / DAY);
}

/** 24. 4., with the year when it is not this year. */
export function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return year === new Date().getFullYear() ? `${day}. ${month}.` : `${day}. ${month}. ${year}`;
}

/** A due date in the list: Dnes, Zítra, Včera, or the date. */
export function dueLabel(date: string | null): string {
  if (!date) return '–';
  return ({ 0: 'Dnes', 1: 'Zítra', [-1]: 'Včera' } as Record<number, string>)[daysFrom(date)] ?? shortDate(date);
}

/** Today or later than its due date, and not closed: shown in red. */
export function isUrgent(date: string | null, status: Status): boolean {
  return date !== null && status !== 'closed' && daysFrom(date) <= 0;
}

/** 24. 4. 2026 */
export function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return `${day}. ${month}. ${year}`;
}

const time = (moment: Date) => moment.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const dateOf = (moment: Date) =>
  `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, '0')}-${String(moment.getDate()).padStart(2, '0')}`;

/** 22. 4. 2026, 14:32 */
export function dateTime(iso: string): string {
  const moment = new Date(iso);
  return `${longDate(dateOf(moment))}, ${time(moment)}`;
}

/** When something happened: dnes v 16:20, včera v 17:12, 20. 4. v 9:05. */
export function ago(iso: string): string {
  const moment = new Date(iso);
  const days = daysFrom(dateOf(moment));
  const day = days === 0 ? 'dnes' : days === -1 ? 'včera' : shortDate(dateOf(moment));
  return `${day} v ${time(moment)}`;
}

/** 1,2 MB */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} kB`;
  return `${(bytes / 1024 / 1024).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} MB`;
}

/** Initials for an avatar: Jan Novák → JN. */
export function initials(name: string): string {
  return name.split(/\s+/).map(word => word[0] ?? '').join('').slice(0, 2).toUpperCase();
}
