import type { DB } from './supabase/server';
import { addDays, weekday } from './dates';
import type { Slot } from './types';

/** Создаёт уроки из постоянного расписания на даты [from, to], если их ещё нет. */
export async function ensureLessons(sb: DB, from: string, to: string) {
  const { data: slots } = await sb
    .from('recurring_slots')
    .select('*, students!inner(price, archived)')
    .eq('students.archived', false)
    .lte('starts_on', to)
    .or(`ends_on.is.null,ends_on.gte.${from}`);

  const rows = [];
  for (const s of (slots ?? []) as (Slot & { students: { price: number } })[]) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (weekday(d) !== s.weekday || d < s.starts_on || (s.ends_on && d > s.ends_on)) continue;
      rows.push({
        student_id: s.student_id,
        slot_id: s.id,
        slot_date: d,
        lesson_date: d,
        start_time: s.start_time,
        duration_min: s.duration_min,
        price: s.students.price,
      });
    }
  }
  if (rows.length) {
    await sb.from('lessons').upsert(rows, { onConflict: 'slot_id,slot_date', ignoreDuplicates: true });
  }
}
