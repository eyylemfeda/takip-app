import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            const c = (cookieStore as any).get?.(name);
            return c?.value as string | undefined;
          } catch {
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            (cookieStore as any).set?.(name, value, { ...options, path: '/' });
          } catch {
            /* ignore */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            (cookieStore as any).set?.(name, '', { ...options, path: '/' });
          } catch {
            /* ignore */
          }
        },
      },
    }
  );
};
