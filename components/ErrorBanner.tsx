'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function ErrorBanner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const err = params.get('err');
  if (!err) return null;
  const rest = new URLSearchParams(params);
  rest.delete('err');
  const close = rest.size ? `${pathname}?${rest}` : pathname;
  return (
    <div className="card banner">
      <span>
        Не получилось сохранить. <span className="muted small">{err}</span>
      </span>
      <Link href={close} className="small">
        Закрыть
      </Link>
    </div>
  );
}
