import { signIn, signUp } from '@/app/actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string; m?: string }> }) {
  const { e, m } = await searchParams;
  return (
    <main className="narrow">
      <h1>Уроки музыки</h1>
      {e && <p className="error">{e}</p>}
      {m && <p className="ok">{m}</p>}
      <form className="card stack">
        <label>
          Почта
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Пароль
          <input name="password" type="password" required minLength={6} autoComplete="current-password" />
        </label>
        <button formAction={signIn}>Войти</button>
        <button formAction={signUp} className="secondary">Создать аккаунт</button>
      </form>
    </main>
  );
}
