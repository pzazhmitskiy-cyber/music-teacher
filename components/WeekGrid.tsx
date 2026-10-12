import Link from 'next/link';
import { hhmm, LESSON_FORMS, nowMinutes, plural, toMinutes, WEEKDAYS } from '@/lib/dates';
import { fullName, type Kind, type Lesson } from '@/lib/types';

type Row = Lesson & { students: { name: string; last_name: string | null; kind: Kind } | null };

const HOUR = 48; // высота часа, px

type Props = {
  days: string[];
  rows: Row[];
  now: string;
  lessonHref: (id: string) => string;
  selected?: string;
};

export function WeekGrid({ days, rows, now, lessonHref, selected }: Props) {
  const starts = rows.map((l) => toMinutes(l.start_time));
  const ends = rows.map((l) => toMinutes(l.start_time) + l.duration_min);
  const from = Math.max(0, Math.min(9, ...starts.map((m) => Math.floor(m / 60))));
  const to = Math.min(24, Math.max(21, ...ends.map((m) => Math.ceil(m / 60))));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = (to - from) * HOUR;
  const nowLine = nowMinutes();

  return (
    <div className="week-scroll">
      <div className="week-grid">
        <div />
        {days.map((d, i) => {
          const count = rows.filter((l) => l.lesson_date === d && l.status !== 'cancelled').length;
          return (
            <div key={d} className={`week-head ${d === now ? 'today' : ''}`}>
              <span className="muted small">{WEEKDAYS[i]}</span>
              <span className="week-day">{Number(d.slice(8))}</span>
              <span className="muted small">{count ? `${count} ${plural(count, LESSON_FORMS)}` : '—'}</span>
            </div>
          );
        })}

        <div className="week-hours" style={{ height }}>
          {hours.map((h) => (
            <span key={h} style={{ top: (h - from) * HOUR }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="week-col" style={{ height, backgroundSize: `100% ${HOUR}px` }}>
            {rows
              .filter((l) => l.lesson_date === d)
              .map((l) => {
                const top = ((toMinutes(l.start_time) - from * 60) * HOUR) / 60;
                // Урок через полночь обрезаем по краю сетки
                const h = Math.min(height - top, Math.max(22, (l.duration_min * HOUR) / 60 - 2));
                return (
                  <Link
                    key={l.id}
                    href={lessonHref(l.id)}
                    scroll={false}
                    className={`week-lesson ${l.status} ${l.students?.kind === 'school' ? 'school' : ''} ${selected === l.id ? 'selected' : ''}`}
                    style={{ top, height: h }}
                  >
                    {h < 32 ? (
                      <strong>
                        {hhmm(l.start_time)} {l.students ? fullName(l.students) : '?'}
                      </strong>
                    ) : (
                      <>
                        <strong>{l.students ? fullName(l.students) : '?'}</strong>
                        <span>{hhmm(l.start_time)}</span>
                      </>
                    )}
                  </Link>
                );
              })}
            {d === now && nowLine >= from * 60 && nowLine <= to * 60 && (
              <div className="week-now" style={{ top: ((nowLine - from * 60) * HOUR) / 60 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
