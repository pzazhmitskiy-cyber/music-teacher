import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabase() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Вызвано из серверного компонента: куки обновит middleware.
          }
        },
      },
    },
  );
}

export type DB = Awaited<ReturnType<typeof supabase>>;
