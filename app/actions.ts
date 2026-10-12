'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
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

/** Ошибку показываем на той же странице вместо «Application error». */
async function guard(fd: FormData, fn: (fd: FormData) => Promise<void>) {
  try {
    await fn(fd);
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    const to = str(fd, 'back');
    const url = new URL(to && to.startsWith('/') ? to : '/schedule', 'http://local');
    url.searchParams.set('err', e instanceof Error ? e.message : String(e));
    redirect(url.pathname + url.search);
  }
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

async function createStudent_(fd: FormData) {
  const sb = await supabase();
  const { data, error } = await sb
    .from('students')
    .insert({
      name: str(fd, 'name') ?? 'Без имени',
      last_name: str(fd, 'last_name'),
      instrument: str(fd, 'instrument'),
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

async function updateStudent_(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const price = int(fd, 'price');
  await check(
    sb
      .from('students')
      .update({
        name: str(fd, 'name') ?? 'Без имени',
        kind: str(fd, 'kind') === 'school' ? 'school' : 'private',
        last_name: str(fd, 'last_name'),
        birth_date: isDate(str(fd, 'birth_date')) ? str(fd, 'birth_date') : null,
        documents: str(fd, 'documents'),
        citizenship: str(fd, 'citizenship'),
        address: str(fd, 'address'),
        instrument: str(fd, 'instrument'),
        about: str(fd, 'about'),
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

async function setArchived_(fd: FormData) {
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

async function deleteStudent_(fd: FormData) {
  const sb = await supabase();
  // Удалить можно только ученика из архива: уроки, оплаты и родители удаляются вместе с ним
  await check(sb.from('students').delete().eq('id', str(fd, 'id')!).eq('archived', true));
  revalidatePath('/', 'layout');
  redirect('/students?archived=1');
}

async function resetShareLink_(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  await check(sb.from('students').update({ share_token: crypto.randomUUID().replaceAll('-', '') }).eq('id', id));
  back(fd, `/students/${id}`);
}

// Родители

async function addParent_(fd: FormData) {
  const sb = await supabase();
  const studentId = str(fd, 'student_id')!;
  await check(
    sb.from('parents').insert({
      student_id: studentId,
      name: str(fd, 'name') ?? 'Родитель',
      phone: str(fd, 'phone'),
      email: str(fd, 'email'),
    }),
  );
  back(fd, `/students/${studentId}`);
}

async function updateParent_(fd: FormData) {
  const sb = await supabase();
  await check(
    sb
      .from('parents')
      .update({ name: str(fd, 'name') ?? 'Родитель', phone: str(fd, 'phone'), email: str(fd, 'email') })
      .eq('id', str(fd, 'id')!),
  );
  back(fd, '/students');
}

async function deleteParent_(fd: FormData) {
  const sb = await supabase();
  await check(sb.from('parents').delete().eq('id', str(fd, 'id')!));
  back(fd, '/students');
}

// Постоянное расписание

async function addSlot_(fd: FormData) {
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

async function updateSlot_(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const { data: old, error } = await sb.from('recurring_slots').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  const t = today();
  // Старый слот закрываем, новый начинаем с сегодняшнего дня: прошедшие уроки остаются как были
  await check(sb.from('lessons').delete().eq('slot_id', id).eq('status', 'planned').gte('lesson_date', t));
  await check(sb.from('recurring_slots').update({ ends_on: addDays(t, -1) }).eq('id', id));
  await check(
    sb.from('recurring_slots').insert({
      student_id: old.student_id,
      weekday: int(fd, 'weekday', old.weekday),
      start_time: str(fd, 'start_time') ?? old.start_time,
      duration_min: int(fd, 'duration_min', old.duration_min),
      starts_on: old.starts_on > t ? old.starts_on : t,
    }),
  );
  back(fd, `/students/${old.student_id}`);
}

async function endSlot_(fd: FormData) {
  const sb = await supabase();
  const id = str(fd, 'id')!;
  const t = today();
  // Будущие запланированные уроки по этому слоту больше не нужны
  await check(sb.from('lessons').delete().eq('slot_id', id).eq('status', 'planned').gte('lesson_date', t));
  await check(sb.from('recurring_slots').update({ ends_on: addDays(t, -1) }).eq('id', id));
  back(fd, '/students');
}

// Уроки

async function addLesson_(fd: FormData) {
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

async function setLessonStatus_(fd: FormData) {
  const sb = await supabase();
  const status = str(fd, 'status') as Status;
  if (!STATUSES.includes(status)) throw new Error('Неизвестный статус');
  await check(sb.from('lessons').update({ status }).eq('id', str(fd, 'id')!));
  back(fd, '/schedule');
}

async function updateLesson_(fd: FormData) {
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

async function deleteLesson_(fd: FormData) {
  const sb = await supabase();
  // Удалять можно только разовые; постоянный урок отменяется статусом, иначе он появится снова
  await check(sb.from('lessons').delete().eq('id', str(fd, 'id')!).is('slot_id', null));
  back(fd, '/schedule');
}

async function markPastDone_(fd: FormData) {
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

async function addPayment_(fd: FormData) {
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

async function deletePayment_(fd: FormData) {
  const sb = await supabase();
  await check(sb.from('payments').delete().eq('id', str(fd, 'id')!));
  back(fd, '/students');
}

// Экспортируемые действия: все ошибки идут через guard

export async function createStudent(fd: FormData) {
  return guard(fd, createStudent_);
}
export async function updateStudent(fd: FormData) {
  return guard(fd, updateStudent_);
}
export async function setArchived(fd: FormData) {
  return guard(fd, setArchived_);
}
export async function deleteStudent(fd: FormData) {
  return guard(fd, deleteStudent_);
}
export async function resetShareLink(fd: FormData) {
  return guard(fd, resetShareLink_);
}
export async function addParent(fd: FormData) {
  return guard(fd, addParent_);
}
export async function updateParent(fd: FormData) {
  return guard(fd, updateParent_);
}
export async function deleteParent(fd: FormData) {
  return guard(fd, deleteParent_);
}
export async function addSlot(fd: FormData) {
  return guard(fd, addSlot_);
}
export async function updateSlot(fd: FormData) {
  return guard(fd, updateSlot_);
}
export async function endSlot(fd: FormData) {
  return guard(fd, endSlot_);
}
export async function addLesson(fd: FormData) {
  return guard(fd, addLesson_);
}
export async function setLessonStatus(fd: FormData) {
  return guard(fd, setLessonStatus_);
}
export async function updateLesson(fd: FormData) {
  return guard(fd, updateLesson_);
}
export async function deleteLesson(fd: FormData) {
  return guard(fd, deleteLesson_);
}
export async function markPastDone(fd: FormData) {
  return guard(fd, markPastDone_);
}
export async function addPayment(fd: FormData) {
  return guard(fd, addPayment_);
}
export async function deletePayment(fd: FormData) {
  return guard(fd, deletePayment_);
}
