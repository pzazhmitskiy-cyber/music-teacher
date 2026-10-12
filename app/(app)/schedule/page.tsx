import Link from 'next/link';
import { addLesson, markPastDone } from '@/app/actions';
import { LessonItem } from '@/components/LessonItem';
import { WeekGrid } from '@/components/WeekGrid';
import { ensureLessons } from '@/lib/lessons';
import { addDays, humanDate, isDate, rub, today, weekStart } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { fullName, type Kind, type Lesson } from '@/lib/types';

type Row = Lesson & { students: { name: string; last_name: string | null; kind: Kind } | null };

type Search = { week?: string; view?: string; lesson?: string };

export default async function Schedule({ searchParams }: { searchParams: Promise<Search> }) {
  const { week, view: viewParam, lesson } = await searchParams;
  const view = viewParam === 'list' ? 'list' : 'grid';
  const now = today();
  const start = weekStart(isDate(week) ? week : now);
  const end = addDays(start, 6);
  const href = (w: string, v = view, l?: string) => `/schedule?week=${w}&view=${v}${l ? `&lesson=${l}` : ''}`;
  const back = href(start, view, lesson);

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
  const active = rows.filter((l) => l.status !== 'cancelled');
  const hours = active.reduce((sum, l) => sum + l.duration_min, 0) / 60;
  const income = active.reduce((sum, l) => sum + l.price, 0);
  const selected = rows.find((l) => l.id === lesson);

  return (
    <>
      <div className="spread">
        <Link href={href(addDays(start, -7))}>← Пред.</Link>
        <strong>
          {humanDate(start)} — {humanDate(end)}
        </strong>
        <Link href={href(addDays(start, 7))}>След. →</Link>
      </div>
      <div className="spread" style={{ marginTop: 8 }}>
        <span className="small muted">
          {active.length} ур. · {hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч · {rub(income)}
          {start !== weekStart(now) && (
            <>
              {' · '}
              <Link href={href(weekStart(now))}>сегодня</Link>
            </>
          )}
        </span>
        <span className="tabs">
          <Link href={href(start, 'grid')} className={view === 'grid' ? 'active' : ''}>
            Неделя
          </Link>
          <Link href={href(start, 'list')} className={view === 'list' ? 'active' : ''}>
            Список
          </Link>
        </span>
      </div>

      {hasPastPlanned && (
        <form action={markPastDone} className="card spread">
          <input type="hidden" name="from" value={start} />
          <input type="hidden" name="to" value={end} />
          <input type="hidden" name="back" value={back} />
          <span className="small">Есть прошедшие уроки без отметки.</span>
          <button className="small">Отметить все проведёнными</button>
        </form>
      )}

      {view === 'grid' && (
        <>
          {selected && (
            <section className="card">
              <div className="spread">
                <strong className="day-title">{humanDate(selected.lesson_date)}</strong>
                <Link href={href(start)} scroll={false} className="small">
                  Закрыть
                </Link>
              </div>
              <LessonItem lesson={selected} back={back} />
            </section>
          )}
          <WeekGrid days={days} rows={rows} now={now} selected={lesson} lessonHref={(id) => href(start, 'grid', id)} />
          <div className="legend">
            <span><i style={{ background: 'var(--accent)' }} />частный</span>
            <span><i style={{ background: '#2e7d9a' }} />школа</span>
            <span><i style={{ background: 'var(--done)' }} />проведён</span>
            <span><i style={{ background: 'var(--missed)' }} />пропуск</span>
            <span><i style={{ border: '1px dashed var(--cancel)' }} />отменён</span>
          </div>
          {!selected && rows.length > 0 && <p className="small muted">Нажмите на урок, чтобы отметить, перенести или записать домашку.</p>}
        </>
      )}

      {view === 'list' && days.map((d) => {
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
