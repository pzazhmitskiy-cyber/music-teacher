import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { capitalize, EVERY_WEEKDAY, humanDate } from '@/lib/dates';

export const metadata: Metadata = { title: 'Занятия музыкой', robots: { index: false } };

type View = {
  name: string;
  year_plan: string | null;
  slots: { weekday: number; time: string }[];
  upcoming: { date: string; time: string }[];
  homework: { date: string; text: string }[];
};

export default async function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await sb.rpc('parent_view', { token });
  if (!data) notFound();
  const v = data as View;

  return (
    <main>
      <h1>{v.name}</h1>

      <h2>Расписание</h2>
      <section className="card stack">
        {v.slots.length === 0 && v.upcoming.length === 0 && <span className="muted">Пока нет занятий в расписании</span>}
        {v.slots.map((s, i) => (
          <span key={i}>
            {capitalize(EVERY_WEEKDAY[s.weekday - 1])} в {s.time}
          </span>
        ))}
        {v.upcoming.map((u, i) => (
          <span key={i}>
            {humanDate(u.date)} в {u.time} <span className="muted small">(дополнительно)</span>
          </span>
        ))}
      </section>

      <h2>Домашние задания</h2>
      <section className="card stack">
        {v.homework.length === 0 && <span className="muted">Пока нет</span>}
        {v.homework.map((h, i) => (
          <div key={i}>
            <div className="muted small">{humanDate(h.date)}</div>
            <div className="pre">{h.text}</div>
          </div>
        ))}
      </section>

      {v.year_plan && (
        <>
          <h2>План на год</h2>
          <section className="card pre">{v.year_plan}</section>
        </>
      )}
    </main>
  );
}
