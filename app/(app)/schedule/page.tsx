import Link from 'next/link';
import { addLesson, markPastDone } from '@/app/actions';
import { LessonItem } from '@/components/LessonItem';
import { ensureLessons } from '@/lib/lessons';
import { addDays, humanDate, isDate, today, weekStart } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { fullName, type Kind, type Lesson } from '@/lib/types';

type Row = Lesson & { students: { name: string; last_name: string | null; kind: Kind } | null };

export default async function Schedule({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const now = today();
  const start = weekStart(isDate(week) ? week : now);
  const end = addDays(start, 6);
  const back = `/schedule?week=${start}`;

  const sb = await supabase();
  await ensureLessons(sb, start, end);
  const [{ data: lessons }, { data: students }] = await Promise.all([
    sb
      .from('lessons')
      .select('*, students(name, last_name, kind)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .order('lesson_date')
      .order('start_time'),
    sb.from('students').select('id, name, last_name').eq('archived', false).order('last_name').order('name'),
  ]);
  const rows = (lessons ?? []) as Row[];
  const hasPastPlanned = rows.some((l) => l.status === 'planned' && l.lesson_date < now);

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <>
      <div className="spread">
        <Link href={`/schedule?week=${addDays(start, -7)}`}>← Пред.</Link>
        <strong>
          {humanDate(start)} — {humanDate(end)}
        </strong>
        <Link href={`/schedule?week=${addDays(start, 7)}`}>След. →</Link>
      </div>
      {start !== weekStart(now) && (
        <p className="small">
          <Link href="/schedule">К текущей неделе</Link>
        </p>
      )}

      {hasPastPlanned && (
        <form action={markPastDone} className="card spread">
          <input type="hidden" name="from" value={start} />
          <input type="hidden" name="to" value={end} />
          <input type="hidden" name="back" value={back} />
          <span className="small">Есть прошедшие уроки без отметки.</span>
          <button className="small">Отметить все проведёнными</button>
        </form>
      )}

      {days.map((d) => {
        const dayLessons = rows.filter((l) => l.lesson_date === d);
        return (
          <section key={d} className="card">
            <div className={`day-title ${d === now ? 'today' : ''}`}>
              {humanDate(d)}
              {d === now && ' · сегодня'}
            </div>
            {dayLessons.length === 0 && <div className="muted small">Нет уроков</div>}
            {dayLessons.map((l) => (
              <LessonItem key={l.id} lesson={l} back={back} />
            ))}
          </section>
        );
      })}

      <h2>Добавить разовый урок</h2>
      {students && students.length > 0 ? (
        <form action={addLesson} className="card stack">
          <input type="hidden" name="back" value={back} />
          <label>
            Ученик
            <select name="student_id" required>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {fullName(s)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid">
            <label>
              Дата
              <input type="date" name="lesson_date" defaultValue={now >= start && now <= end ? now : start} required />
            </label>
            <label>
              Время
              <input type="time" name="start_time" defaultValue="16:00" required />
            </label>
            <label>
              Цена, ₽ (пусто = из карточки)
              <input type="number" name="price" min={0} />
            </label>
          </div>
          <button>Добавить</button>
        </form>
      ) : (
        <p className="muted">
          Сначала <Link href="/students">добавьте ученика</Link>.
        </p>
      )}
    </>
  );
}
