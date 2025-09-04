'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get('next') || '/';
  const supabase = createClient();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const ok = !!data.session;
      setHasSession(ok);
      if (ok) {
        const t = setTimeout(() => router.replace(nextUrl), 1200);
        return () => clearTimeout(t);
      }
    })();
  }, [supabase, router, nextUrl]);

  if (hasSession === false) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border bg-white p-6 shadow text-center">
          <h1 className="mb-2 text-2xl font-semibold">Doğrulama Tamamlanamadı</h1>
          <p className="mb-6 text-gray-600">Aktif bir oturum bulunamadı. Lütfen giriş yapın.</p>
          <Link href="/login" className="inline-flex items-center justify-center rounded-md border px-4 py-2 hover:bg-gray-50">
            Giriş Sayfasına Dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow text-center">
        <h1 className="mb-2 text-2xl font-semibold">Kayıt ve Doğrulama Tamamlandı ✅</h1>
        <p className="mb-6 text-gray-600">Hesabınla giriş yapıldı. Az sonra yönlendirileceksin.</p>
        <Link
          href={nextUrl}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Panele Git
        </Link>
      </div>
    </main>
  );
}

export default function AuthSuccess() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-gray-600">Yükleniyor…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
