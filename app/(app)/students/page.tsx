import Link from 'next/link';
import { createStudent } from '@/app/actions';
import { rub } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { KIND_LABEL, type Student } from '@/lib/types';

export default async function Students({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const showArchived = archived === '1';
  const sb = await supabase();
  const { data } = await sb.from('students').select('*').eq('archived', showArchived).order('name');
  const students = (data ?? []) as Student[];

  return (
    <>
      <div className="spread">
        <h1>{showArchived ? 'Архив' : 'Ученики'}</h1>
        <Link className="small" href={showArchived ? '/students' : '/students?archived=1'}>
          {showArchived ? 'Текущие ученики' : 'Архив'}
        </Link>
      </div>

      {students.length === 0 && <p className="muted">Пока никого.</p>}
      {students.map((s) => (
        <Link key={s.id} href={`/students/${s.id}`} className="card spread" style={{ color: 'inherit' }}>
          <strong>{s.name}</strong>
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
            <label>
              Имя
              <input name="name" required />
            </label>
            <div className="grid">
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
