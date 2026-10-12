// Даты храним строками YYYY-MM-DD и считаем в UTC, чтобы не зависеть от часового пояса сервера.

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** «Каждый …» в правильном роде: каждую среду, каждое воскресенье */
export const EVERY_WEEKDAY = [
  'каждый понедельник',
  'каждый вторник',
  'каждую среду',
  'каждый четверг',
  'каждую пятницу',
  'каждую субботу',
  'каждое воскресенье',
];

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** plural(5, ['урок', 'урока', 'уроков']) → «уроков» */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

export const LESSON_FORMS: [string, string, string] = ['урок', 'урока', 'уроков'];

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
  const name = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', month: 'long' }).format(parse(month + '-01'));
  return `${capitalize(name)} ${month.slice(0, 4)}`;
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function rub(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

/** Минуты с начала суток в часовом поясе учителя */
export function nowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
