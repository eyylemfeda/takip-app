import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Supabase server client — middleware köprüsü (req<->res cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = req.nextUrl;

  // Korumalı yollar: ANASAYFA dahil
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/records') ||
    pathname.startsWith('/books');

  // Oturum yoksa login'e gönder (next param'ını koru)
  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set(
      'next',
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    );
    return NextResponse.redirect(url);
  }

  return res;
}

// Sadece bu yollar dinlenir (login/auth dışarıda tutuluyor)
export const config = {
  matcher: ['/', '/profile/:path*', '/records/:path*', '/books/:path*'],
};
