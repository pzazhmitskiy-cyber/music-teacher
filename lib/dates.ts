// Даты храним строками YYYY-MM-DD и считаем в UTC, чтобы не зависеть от часового пояса сервера.

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

const TZ = process.env.TEACHER_TZ || 'Europe/Moscow';

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

/** 1 = понедельник … 7 = воскресенье */
export function weekday(s: string): number {
  const w = parse(s).getUTCDay();
  return w === 0 ? 7 : w;
}

export function weekStart(s: string): string {
  return addDays(s, 1 - weekday(s));
}

export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const first = format(new Date(Date.UTC(y, m - 1, 1)));
  const last = format(new Date(Date.UTC(y, m, 0)));
  return [first, last];
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return format(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}

export function humanDate(s: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' }).format(parse(s));
}

export function humanMonth(month: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(parse(month + '-01'));
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function rub(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}
