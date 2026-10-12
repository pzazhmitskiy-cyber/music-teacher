import Link from 'next/link';
import { deleteLesson, setLessonStatus, updateLesson } from '@/app/actions';
import { hhmm, humanDate, rub } from '@/lib/dates';
import { KIND_LABEL, STATUS_LABEL, type Kind, type Lesson } from '@/lib/types';

type Props = {
  lesson: Lesson & { students?: { name: string; kind: Kind } | null };
  back: string;
  showDate?: boolean;
};

export function LessonItem({ lesson: l, back, showDate }: Props) {
  return (
    <div className={`lesson ${l.status}`}>
      <div className="spread">
        <div className="row">
          <span className="time">{hhmm(l.start_time)}</span>
          {showDate && <span className="muted small">{humanDate(l.lesson_date)}</span>}
          {l.students && (
            <Link className="who" href={`/students/${l.student_id}`}>
              {l.students.name}
            </Link>
          )}
          {l.students?.kind === 'school' && <span className="badge school">{KIND_LABEL.school}</span>}
          {l.slot_id === null && <span className="muted small">разовый</span>}
        </div>
        <span className={`badge ${l.status}`}>{STATUS_LABEL[l.status]}</span>
      </div>

      {l.homework && <div className="small pre">📝 {l.homework}</div>}

      <form action={setLessonStatus} className="row">
        <input type="hidden" name="id" value={l.id} />
        <input type="hidden" name="back" value={back} />
        {l.status !== 'done' && <button className="small" name="status" value="done">Проведён</button>}
        {l.status !== 'cancelled' && <button className="small ghost" name="status" value="cancelled">Отменить</button>}
        {l.status !== 'missed' && <button className="small ghost" name="status" value="missed">Пропуск</button>}
        {l.status !== 'planned' && <button className="small ghost" name="status" value="planned">Вернуть</button>}
      </form>

      <details>
        <summary>Домашка, заметка, перенос · {rub(l.price)}</summary>
        <form action={updateLesson} className="stack">
          <input type="hidden" name="id" value={l.id} />
          <input type="hidden" name="back" value={back} />
          <label>
            Домашнее задание (видно родителям)
            <textarea name="homework" defaultValue={l.homework ?? ''} />
          </label>
          <label>
            Заметка для себя
            <textarea name="note" defaultValue={l.note ?? ''} />
          </label>
          <div className="grid">
            <label>
              Дата
              <input type="date" name="lesson_date" defaultValue={l.lesson_date} />
            </label>
            <label>
              Время
              <input type="time" name="start_time" defaultValue={hhmm(l.start_time)} />
            </label>
            <label>
              Цена, ₽
              <input type="number" name="price" min={0} defaultValue={l.price} />
            </label>
          </div>
          <div className="row">
            <button className="small">Сохранить</button>
            {l.slot_id === null && (
              <button className="small danger" formAction={deleteLesson}>Удалить урок</button>
            )}
          </div>
        </form>
      </details>
    </div>
  );
}
