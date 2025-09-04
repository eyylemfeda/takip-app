'use client';

import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

function AuthErrorInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const msg = params.get('msg') ?? 'Doğrulama başarısız.';
  const nextUrl = params.get('next') || '/';

  // Oturum zaten varsa hata sayfasında bekletme, next'e al
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(nextUrl);
    })();
  }, [supabase, router, nextUrl]);

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow text-center">
        <h1 className="mb-2 text-2xl font-semibold">Doğrulama Başarısız</h1>
        <p className="mb-6 text-red-600 break-words">{msg}</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            Giriş Sayfasına Dön
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-black/90"
          >
            Ana Sayfa
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-gray-600">Yükleniyor…</div>}>
      <AuthErrorInner />
    </Suspense>
  );
}
