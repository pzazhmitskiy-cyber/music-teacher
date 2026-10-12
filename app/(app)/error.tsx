'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card stack">
      <strong>Что-то пошло не так</strong>
      <span className="muted small">
        Попробуйте обновить страницу. Если ошибка повторяется, пришлите этот код: {error.digest ?? error.message}
      </span>
      <div className="row">
        <button onClick={reset}>Обновить</button>
        <a href="/schedule">К расписанию</a>
      </div>
    </section>
  );
}
