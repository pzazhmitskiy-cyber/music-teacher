'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase/server';
import { addDays, isDate, today } from '@/lib/dates';
import type { Status } from '@/lib/types';

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function int(fd: FormData, key: string, fallback = 0): number {
  const n = parseInt(str(fd, key) ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function back(fd: FormData, fallback: string) {
  const to = str(fd, 'back');
  revalidatePath('/', 'layout');
  redirect(to && to.startsWith('/') ? to : fallback);
}

async function check(promise: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await promise;
  if (error) throw new Error(error.message);
}

// Вход

export async function signIn(fd: FormData) {
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({
    email: str(fd, 'email') ?? '',
    password: str(fd, 'password') ?? '',
  });
  if (error) redirect('/login?e=' + encodeURIComponent('Неверная почта или пароль'));
  redirect('/schedule');
}

export async function signUp(fd: FormData) {
  const sb = await supabase();
  const { data, error } = await sb.auth.signUp({
    email: str(fd, 'email') ?? '',
    password: str(fd, 'password') ?? '',
  });
  if (error) redirect('/login?e=' + encodeURIComponent(error.message));
  if (!data.session) redirect('/login?m=' + encodeURIComponent('Проверьте почту и подтвердите адрес, затем войдите.'));
  redirect('/schedule');
}

export async function signOut() {
  const sb = await supabase();
  await sb.auth.signOut();
  redirect('/login');
}

// Ученики

export async function createStudent(fd: FormData) {
  const sb = await supabase();
  const { data, error } = await sb
    .from('students')
    .insert({
      name: str(fd, 'name') ?? 'Без имени',
      kind: str(fd, 'kind') === 'school' ? 'school' : 'private',
      price: int(fd, 'price'),
      duration_min: int(fd, 'duration_min', 45),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  redirect(`/students/${data.id}`);
}

export async function updateStudent(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const price = int(fd, 'price');
  await check(
    sb
      .from('students')
      .update({
        name: str(fd, 'name') ?? 'Без имени',
        kind: str(fd, 'kind') === 'school' ? 'school' : 'private',
        parent_name: str(fd, 'parent_name'),
        contact: str(fd, 'contact'),
        price,
        duration_min: int(fd, 'duration_min', 45),
        notes: str(fd, 'notes'),
        year_plan: str(fd, 'year_plan'),
      })
      .eq('id', id),
  );
  // Новая цена действует на ещё не проведённые уроки
  await check(
    sb.from('lessons').update({ price }).eq('student_id', id).eq('status', 'planned').gte('lesson_date', today()),
  );
  back(fd, `/students/${id}`);
}

export async function setArchived(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const archived = str(fd, 'archived') === 'true';
  await check(sb.from('students').update({ archived }).eq('id', id));
  if (archived) {
    // Убираем будущие запланированные уроки
    await check(
      sb.from('lessons').delete().eq('student_id', id).eq('status', 'planned').gte('lesson_date', today()),
    );
  }
  back(fd, `/students/${id}`);
}

export async function resetShareLink(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  await check(sb.from('students').update({ share_token: crypto.randomUUID().replaceAll('-', '') }).eq('id', id));
  back(fd, `/students/${id}`);
}

// Постоянное расписание

export async function addSlot(fd: FormData) {
  const sb = await supabase();
  const studentId = str(fd, 'student_id')!;
  const startsOn = str(fd, 'starts_on');
  await check(
    sb.from('recurring_slots').insert({
      student_id: studentId,
      weekday: int(fd, 'weekday', 1),
      start_time: str(fd, 'start_time') ?? '16:00',
      duration_min: int(fd, 'duration_min', 45),
      starts_on: isDate(startsOn) ? startsOn : today(),
    }),
  );
  back(fd, `/students/${studentId}`);
}

export async function endSlot(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const t = today();
  // Будущие запланированные уроки по этому слоту больше не нужны
  await check(sb.from('lessons').delete().eq('slot_id', id).eq('status', 'planned').gte('lesson_date', t));
  await check(sb.from('recurring_slots').update({ ends_on: addDays(t, -1) }).eq('id', id));
  back(fd, '/students');
}

// Уроки

export async function addLesson(fd: FormData) {
  const sb = await supabase();
  const studentId = str(fd, 'student_id')!;
  const { data: s } = await sb.from('students').select('price, duration_min').eq('id', studentId).single();
  const date = str(fd, 'lesson_date');
  await check(
    sb.from('lessons').insert({
      student_id: studentId,
      lesson_date: isDate(date) ? date : today(),
      start_time: str(fd, 'start_time') ?? '16:00',
      duration_min: int(fd, 'duration_min', s?.duration_min ?? 45),
      price: str(fd, 'price') ? int(fd, 'price') : (s?.price ?? 0),
    }),
  );
  back(fd, '/schedule');
}

const STATUSES: Status[] = ['planned', 'done', 'cancelled', 'missed'];

export async function setLessonStatus(fd: FormData) {
  const sb = await supabase();
  const status = str(fd, 'status') as Status;
  if (!STATUSES.includes(status)) throw new Error('Неизвестный статус');
  await check(sb.from('lessons').update({ status }).eq('id', str(fd, 'id')!));
  back(fd, '/schedule');
}

export async function updateLesson(fd: FormData) {
  const sb = await supabase();
  const date = str(fd, 'lesson_date');
  const patch: Record<string, unknown> = {
    homework: str(fd, 'homework'),
    note: str(fd, 'note'),
    price: int(fd, 'price'),
  };
  if (isDate(date)) patch.lesson_date = date;
  const time = str(fd, 'start_time');
  if (time) patch.start_time = time;
  await check(sb.from('lessons').update(patch).eq('id', str(fd, 'id')!));
  back(fd, '/schedule');
}

export async function deleteLesson(fd: FormData) {
  const sb = await supabase();
  // Удалять можно только разовые; постоянный урок отменяется статусом, иначе он появится снова
  await check(sb.from('lessons').delete().eq('id', str(fd, 'id')!).is('slot_id', null));
  back(fd, '/schedule');
}

export async function markPastDone(fd: FormData) {
  const sb = await supabase();
  const from = str(fd, 'from');
  if (!isDate(from)) throw new Error('Нет даты');
  const yesterday = addDays(today(), -1);
  const to = str(fd, 'to');
  const until = isDate(to) && to < yesterday ? to : yesterday;
  await check(
    sb.from('lessons').update({ status: 'done' }).eq('status', 'planned').gte('lesson_date', from).lte('lesson_date', until),
  );
  back(fd, '/schedule');
}

// Оплаты

export async function addPayment(fd: FormData) {
  const sb = await supabase();
  const studentId = str(fd, 'student_id')!;
  const date = str(fd, 'paid_on');
  await check(
    sb.from('payments').insert({
      student_id: studentId,
      amount: int(fd, 'amount'),
      paid_on: isDate(date) ? date : today(),
      note: str(fd, 'note'),
    }),
  );
  back(fd, `/students/${studentId}`);
}

export async function deletePayment(fd: FormData) {
  const sb = await supabase();
  await check(sb.from('payments').delete().eq('id', str(fd, 'id')!));
  back(fd, '/students');
}
