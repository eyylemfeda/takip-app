// middleware.ts  (PROJE KÖKÜNE KOY)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // 1) Public yolları tamamen bypass et (auth akışı ve statikler)
  const publicPaths = [
    '/login',
    '/signup',
    '/forgot',        // ← eklendi
    '/auth/reset',   // ← eklendi
    '/auth/callback',
    '/auth/success',
    '/auth/error',
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/images',
    '/public',
  ];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 2) Supabase server client (cookie köprüsü)
  const res = NextResponse.next();
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
          res.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  // 3) Oturumu getir (gerekirse yeniler)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // --- DEBUG HEADER’LAR (Network → Response Headers’tan görebilirsin)
  res.headers.set('x-debug-path', pathname);
  res.headers.set('x-debug-has-session', user ? '1' : '0');
  if (session?.expires_at) res.headers.set('x-debug-expires', String(session.expires_at));
  if (sessionError) res.headers.set('x-debug-session-error', sessionError.message);

  // 4) Korumalı yollar
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/records') ||
    pathname.startsWith('/books') ||
    pathname.startsWith('/admin');

  if (isProtected) {
    // 4a) Oturum yoksa → login
    if (!user) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      const nextValue = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      redirectUrl.searchParams.set('next', nextValue);
      return NextResponse.redirect(redirectUrl);
    }

    // 4b) Oturum var → profiles.is_active kontrolü
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle();

    // debug: prof/is_active
    res.headers.set('x-debug-profile', profErr ? 'error' : (prof ? 'hit' : 'miss'));
    res.headers.set('x-debug-active', prof?.is_active ? '1' : '0');

    // aktif değilse ya da profil bulunamadıysa → login?err=not_allowed
    if (profErr || !prof || prof.is_active === false) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('err', 'not_allowed');
      const nextValue = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      redirectUrl.searchParams.set('next', nextValue);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 5) Devam
  return res;
}

// Hangi path’lerde middleware çalışsın?
export const config = {
  matcher: [
    '/',
    '/profile/:path*',
    '/records/:path*',
    '/books/:path*',
    '/admin/:path*',
  ],
};
