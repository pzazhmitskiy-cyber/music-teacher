import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect('/login');

  return (
    <>
      <nav className="nav">
        <Link href="/schedule">Расписание</Link>
        <Link href="/students">Ученики</Link>
        <Link href="/month">Месяц</Link>
        <form action={signOut}>
          <button className="link">Выйти</button>
        </form>
      </nav>
      <main>{children}</main>
    </>
  );
}
