import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  addParent,
  addPayment,
  addSlot,
  deleteParent,
  deletePayment,
  endSlot,
  resetShareLink,
  setArchived,
  updateParent,
  updateStudent,
} from '@/app/actions';
import { LessonItem } from '@/components/LessonItem';
import { ensureLessons } from '@/lib/lessons';
import { addDays, hhmm, humanDate, rub, today, WEEKDAYS, WEEKDAYS_FULL } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { BILLABLE, fullName, type Lesson, type Parent, type Payment, type Slot, type Student } from '@/lib/types';

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabase();
  const now = today();
  await ensureLessons(sb, now, addDays(now, 13));

  const { data: student } = await sb.from('students').select('*').eq('id', id).maybeSingle();
  if (!student) notFound();
  const s = student as Student;

  const [{ data: slots }, { data: lessons }, { data: payments }, { data: billable }, { data: parents }] = await Promise.all([
    sb.from('recurring_slots').select('*').eq('student_id', id).or(`ends_on.is.null,ends_on.gte.${now}`).order('weekday').order('start_time'),
    sb.from('lessons').select('*').eq('student_id', id).order('lesson_date', { ascending: false }).order('start_time', { ascending: false }).limit(30),
    sb.from('payments').select('*').eq('student_id', id).order('paid_on', { ascending: false }),
    sb.from('lessons').select('price').eq('student_id', id).in('status', BILLABLE),
    sb.from('parents').select('*').eq('student_id', id).order('created_at'),
  ]);

  const paid = ((payments ?? []) as Payment[]).reduce((sum, p) => sum + p.amount, 0);
  const owed = (billable ?? []).reduce((sum, l) => sum + (l.price as number), 0);
  const balance = paid - owed;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const shareUrl = `${proto}://${host}/p/${s.share_token}`;
  const back = `/students/${id}`;

  const all = (lessons ?? []) as Lesson[];
  const upcoming = all.filter((l) => l.lesson_date >= now && l.status === 'planned').reverse();
  const past = all.filter((l) => !upcoming.includes(l));

  return (
    <>
      <p className="small">
        <Link href="/students">← Все ученики</Link>
      </p>
      <h1>{fullName(s)}{s.archived && <span className="muted"> · в архиве</span>}</h1>

      <section className="card">
        <div className="spread">
          <div>
            <div className="muted small">Баланс</div>
            <div className={`big ${balance < 0 ? 'error' : 'ok'}`}>{rub(balance)}</div>
            <div className="muted small">
              {balance < 0 ? 'Долг за проведённые уроки' : 'Предоплата'} · оплачено {rub(paid)}, уроков на {rub(owed)}
            </div>
          </div>
        </div>
      </section>

      <h2>Постоянные уроки</h2>
      <section className="card stack">
        {((slots ?? []) as Slot[]).map((slot) => (
          <form key={slot.id} action={endSlot} className="spread">
            <input type="hidden" name="id" value={slot.id} />
            <input type="hidden" name="back" value={back} />
            <span>
              Каждый {WEEKDAYS_FULL[slot.weekday - 1]}, {hhmm(slot.start_time)} · {slot.duration_min} мин
              {slot.starts_on > now && <span className="muted small"> с {humanDate(slot.starts_on)}</span>}
            </span>
            <button className="small ghost">Убрать</button>
          </form>
        ))}
        {(slots ?? []).length === 0 && <span className="muted small">Нет постоянных уроков</span>}
        <form action={addSlot} className="grid">
          <input type="hidden" name="student_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <label>
            День
            <select name="weekday" defaultValue="1">
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i + 1}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Время
            <input type="time" name="start_time" defaultValue="16:00" required />
          </label>
          <label>
            Минут
            <input type="number" name="duration_min" min={5} step={5} defaultValue={s.duration_min} />
          </label>
          <label>
            Начиная с
            <input type="date" name="starts_on" defaultValue={now} />
          </label>
          <button className="small">Добавить</button>
        </form>
      </section>

      <h2>Ближайшие уроки</h2>
      <section className="card">
        {upcoming.length === 0 && <span className="muted small">Нет запланированных уроков</span>}
        {upcoming.map((l) => (
          <LessonItem key={l.id} lesson={l} back={back} showDate />
        ))}
      </section>

      <h2>Карточка</h2>
      <form action={updateStudent} className="card stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={back} />
        <div className="grid">
          <label>
            Имя
            <input name="name" defaultValue={s.name} required />
          </label>
          <label>
            Фамилия
            <input name="last_name" defaultValue={s.last_name ?? ''} />
          </label>
          <label>
            Дата рождения
            <input type="date" name="birth_date" defaultValue={s.birth_date ?? ''} />
          </label>
          <label>
            Инструмент
            <input name="instrument" defaultValue={s.instrument ?? ''} />
          </label>
          <label>
            Гражданство
            <input name="citizenship" defaultValue={s.citizenship ?? ''} />
          </label>
          <label>
            Где учится
            <select name="kind" defaultValue={s.kind}>
              <option value="private">Частный</option>
              <option value="school">Школа</option>
            </select>
          </label>
          <label>
            Цена урока, ₽
            <input type="number" name="price" min={0} defaultValue={s.price} />
          </label>
          <label>
            Длительность, мин
            <input type="number" name="duration_min" min={5} step={5} defaultValue={s.duration_min} />
          </label>
        </div>
        <label>
          Домашний адрес
          <input name="address" defaultValue={s.address ?? ''} />
        </label>
        <label>
          Документы
          <textarea name="documents" rows={3} placeholder="Паспорт / свидетельство о рождении: серия, номер, кем и когда выдан" defaultValue={s.documents ?? ''} />
        </label>
        <label>
          Общая информация
          <textarea name="about" defaultValue={s.about ?? ''} />
        </label>
        <label>
          План на год (виден родителям)
          <textarea name="year_plan" rows={6} defaultValue={s.year_plan ?? ''} />
        </label>
        <label>
          Заметки и комментарии (только для вас)
          <textarea name="notes" defaultValue={s.notes ?? ''} />
        </label>
        <button>Сохранить</button>
      </form>

      <h2>Родители</h2>
      <section className="card stack">
        {((parents ?? []) as Parent[]).map((p) => (
          <form key={p.id} action={updateParent} className="grid">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="back" value={back} />
            <label>
              Имя
              <input name="name" defaultValue={p.name} required />
            </label>
            <label>
              Телефон
              <input type="tel" name="phone" defaultValue={p.phone ?? ''} />
            </label>
            <label>
              Почта
              <input type="email" name="email" defaultValue={p.email ?? ''} />
            </label>
            <div className="row">
              <button className="small">Сохранить</button>
              <button className="small danger" formAction={deleteParent}>Удалить</button>
            </div>
          </form>
        ))}
        <form action={addParent} className="grid">
          <input type="hidden" name="student_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <label>
            Имя родителя
            <input name="name" required placeholder="Мама: Ольга Петровна" />
          </label>
          <label>
            Телефон
            <input type="tel" name="phone" />
          </label>
          <label>
            Почта
            <input type="email" name="email" />
          </label>
          <button className="small secondary">Добавить родителя</button>
        </form>
      </section>

      <h2>Ссылка для родителей</h2>
      <section className="card stack">
        <span className="small muted">
          По ссылке видны план на год, расписание и домашние задания. Цены, оплаты и ваши заметки не видны.
        </span>
        <input readOnly value={shareUrl} />
        <div className="row">
          <a href={shareUrl} target="_blank" rel="noreferrer">
            Открыть
          </a>
          <form action={resetShareLink}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="back" value={back} />
            <button className="small ghost">Сменить ссылку</button>
          </form>
        </div>
      </section>

      <h2>Оплаты</h2>
      <section className="card stack">
        <form action={addPayment} className="grid">
          <input type="hidden" name="student_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <label>
            Сумма, ₽
            <input type="number" name="amount" min={1} required />
          </label>
          <label>
            Дата
            <input type="date" name="paid_on" defaultValue={now} />
          </label>
          <label>
            Комментарий
            <input name="note" />
          </label>
          <button className="small">Добавить оплату</button>
        </form>
        {((payments ?? []) as Payment[]).length > 0 && (
          <table>
            <tbody>
              {((payments ?? []) as Payment[]).map((p) => (
                <tr key={p.id}>
                  <td>{humanDate(p.paid_on)}</td>
                  <td className="muted small">{p.note}</td>
                  <td className="num">{rub(p.amount)}</td>
                  <td className="num">
                    <form action={deletePayment} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="link small">×</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2>Прошедшие уроки</h2>
      <section className="card">
        {past.length === 0 && <span className="muted small">Пока нет</span>}
        {past.map((l) => (
          <LessonItem key={l.id} lesson={l} back={back} showDate />
        ))}
      </section>

      <form action={setArchived} style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archived" value={s.archived ? 'false' : 'true'} />
        <input type="hidden" name="back" value={back} />
        <button className={s.archived ? 'secondary' : 'danger'}>
          {s.archived ? 'Вернуть из архива' : 'Перенести в архив'}
        </button>
      </form>
    </>
  );
}
