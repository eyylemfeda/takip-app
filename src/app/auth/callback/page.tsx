'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Bu sayfa SSG denemesin, her seferinde dinamik çalışsın:
export const dynamic = 'force-dynamic';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const code = params.get('code');
      const next = params.get('next') || '/';

      if (!code) {
        router.replace('/auth/error?msg=Geçersiz%20bağlantı');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/auth/error?msg=${encodeURIComponent(error.message)}`);
      } else {
        router.replace(next);
      }
    })();
  }, [params, router]);

  return (
    <p className="p-4 text-center text-sm text-gray-600">Doğrulama tamamlanıyor…</p>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-sm text-gray-600">Yükleniyor…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
