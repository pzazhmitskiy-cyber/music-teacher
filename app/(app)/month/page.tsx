import Link from 'next/link';
import { humanMonth, monthRange, rub, shiftMonth, today } from '@/lib/dates';
import { supabase } from '@/lib/supabase/server';
import { BILLABLE, fullName, KIND_LABEL, type Kind } from '@/lib/types';

type Row = { price: number; status: string; student_id: string; students: { name: string; last_name: string | null; kind: Kind } | null };

export default async function Month({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today().slice(0, 7);
  const [from, to] = monthRange(month);

  const sb = await supabase();
  const [{ data: lessons }, { data: payments }] = await Promise.all([
    sb.from('lessons').select('price, status, student_id, students(name, last_name, kind)').gte('lesson_date', from).lte('lesson_date', to),
    sb.from('payments').select('amount').gte('paid_on', from).lte('paid_on', to),
  ]);
  const rows = ((lessons ?? []) as unknown as Row[]).filter((l) => BILLABLE.includes(l.status as never));
  const received = (payments ?? []).reduce((sum, p) => sum + (p.amount as number), 0);

  const byKind = (k: Kind) => rows.filter((l) => l.students?.kind === k);
  const total = (list: Row[]) => list.reduce((sum, l) => sum + l.price, 0);

  const perStudent = new Map<string, { name: string; kind: Kind; count: number; sum: number }>();
  for (const l of rows) {
    const e = perStudent.get(l.student_id) ?? { name: l.students ? fullName(l.students) : '?', kind: l.students?.kind ?? 'private', count: 0, sum: 0 };
    e.count += 1;
    e.sum += l.price;
    perStudent.set(l.student_id, e);
  }
  const list = [...perStudent.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'ru'));

  return (
    <>
      <div className="spread">
        <Link href={`/month?m=${shiftMonth(month, -1)}`}>← Пред.</Link>
        <strong style={{ textTransform: 'capitalize' }}>{humanMonth(month)}</strong>
        <Link href={`/month?m=${shiftMonth(month, 1)}`}>След. →</Link>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {(['private', 'school'] as Kind[]).map((k) => (
          <div key={k} className="card">
            <div className="muted small">{KIND_LABEL[k]}</div>
            <div className="big">{rub(total(byKind(k)))}</div>
            <div className="muted small">{byKind(k).length} уроков</div>
          </div>
        ))}
        <div className="card">
          <div className="muted small">Получено оплат</div>
          <div className="big">{rub(received)}</div>
        </div>
      </div>
      <p className="muted small">Считаются проведённые уроки и оплачиваемые пропуски.</p>

      {list.length > 0 && (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th>Ученик</th>
                <th className="num">Уроков</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {list.map(([id, e]) => (
                <tr key={id}>
                  <td>
                    <Link href={`/students/${id}`}>{e.name}</Link>
                    {e.kind === 'school' && <span className="muted small"> · школа</span>}
                  </td>
                  <td className="num">{e.count}</td>
                  <td className="num">{rub(e.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
