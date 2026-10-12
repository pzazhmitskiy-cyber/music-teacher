import Link from 'next/link';
import { createStudent } from '@/app/actions';
import { rub } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { fullName, KIND_LABEL, type Student } from '@/lib/types';

export default async function Students({ searchParams }: { searchParams: Promise<{ archived?: string; q?: string }> }) {
  const { archived, q } = await searchParams;
  const query = (q ?? '').trim().toLowerCase();
  const showArchived = archived === '1';
  const sb = await supabase();
  const { data } = await sb.from('students').select('*').eq('archived', showArchived).order('last_name').order('name');
  const students = ((data ?? []) as Student[]).filter(
    (s) => !query || [fullName(s), s.instrument ?? ''].join(' ').toLowerCase().includes(query),
  );

  return (
    <>
      <div className="spread">
        <h1>{showArchived ? 'Архив' : 'Ученики'}</h1>
        <Link className="small" href={showArchived ? '/students' : '/students?archived=1'}>
          {showArchived ? 'Текущие ученики' : 'Архив'}
        </Link>
      </div>

      <form className="row" style={{ marginBottom: 10 }}>
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <input name="q" defaultValue={q ?? ''} placeholder="Поиск по имени, фамилии или инструменту" style={{ flex: 1 }} />
        <button className="small">Найти</button>
      </form>

      {students.length === 0 && <p className="muted">{query ? 'Никого не нашли.' : 'Пока никого.'}</p>}
      {students.map((s) => (
        <Link key={s.id} href={`/students/${s.id}`} className="card spread" style={{ color: 'inherit' }}>
          <span>
            <strong>{fullName(s)}</strong>
            {s.instrument && <span className="muted small"> · {s.instrument}</span>}
          </span>
          <span className="row small muted">
            <span className={`badge ${s.kind === 'school' ? 'school' : 'planned'}`}>{KIND_LABEL[s.kind]}</span>
            {rub(s.price)} · {s.duration_min} мин
          </span>
        </Link>
      ))}

      {!showArchived && (
        <>
          <h2>Новый ученик</h2>
          <form action={createStudent} className="card stack">
            <input type="hidden" name="back" value="/students" />
            <div className="grid">
              <label>
                Имя
                <input name="name" required />
              </label>
              <label>
                Фамилия
                <input name="last_name" />
              </label>
              <label>
                Инструмент
                <input name="instrument" placeholder="фортепиано" />
              </label>
              <label>
                Где учится
                <select name="kind" defaultValue="private">
                  <option value="private">Частный</option>
                  <option value="school">Школа</option>
                </select>
              </label>
              <label>
                Цена урока, ₽
                <input type="number" name="price" min={0} defaultValue={0} />
              </label>
              <label>
                Длительность, мин
                <input type="number" name="duration_min" min={5} step={5} defaultValue={45} />
              </label>
            </div>
            <button>Добавить</button>
          </form>
        </>
      )}
    </>
  );
}
