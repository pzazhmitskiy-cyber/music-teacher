export type Kind = 'private' | 'school';
export type Status = 'planned' | 'done' | 'cancelled' | 'missed';

export type Student = {
  id: string;
  name: string;
  last_name: string | null;
  birth_date: string | null;
  documents: string | null;
  citizenship: string | null;
  address: string | null;
  instrument: string | null;
  about: string | null;
  kind: Kind;
  price: number;
  duration_min: number;
  notes: string | null;
  year_plan: string | null;
  share_token: string;
  archived: boolean;
};

export type Parent = {
  id: string;
  student_id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type Slot = {
  id: string;
  student_id: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  starts_on: string;
  ends_on: string | null;
};

export type Lesson = {
  id: string;
  student_id: string;
  slot_id: string | null;
  lesson_date: string;
  start_time: string;
  duration_min: number;
  price: number;
  status: Status;
  homework: string | null;
  note: string | null;
};

export type Payment = {
  id: string;
  student_id: string;
  amount: number;
  paid_on: string;
  note: string | null;
};

export function fullName(s: { name: string; last_name?: string | null }): string {
  return [s.name, s.last_name].filter(Boolean).join(' ');
}

export const KIND_LABEL: Record<Kind, string> = { private: 'Частный', school: 'Школа' };
export const STATUS_LABEL: Record<Status, string> = {
  planned: 'Запланирован',
  done: 'Проведён',
  cancelled: 'Отменён',
  missed: 'Пропуск (оплачивается)',
};

/** Уроки, за которые ученик должен заплатить */
export const BILLABLE: Status[] = ['done', 'missed'];
