'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const q = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    // ⏳ Zaman aşımı: 8 sn içinde iş bitmezse login’e düş
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) router.replace('/login?verified=1');
    }, 8000);

    (async () => {
      try {
        const next = q.get('next') || '/auth/success';

        // 0) Zaten oturum varsa direkt geç
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          // (Opsiyonel) username metadata varsa profiles’a yaz
          const { data: u } = await supabase.auth.getUser();
          const uname = u.user?.user_metadata?.username as string | undefined;
          if (u.user?.id && uname) {
            await supabase.from('profiles').upsert(
              { id: u.user.id, username: uname },
              { onConflict: 'id' }
            );
          }
          clearTimeout(fallbackTimer);
          router.replace(next);
          router.refresh();
          return;
        }

        // 1) URL’deki code ile oturum açmayı dene
        const code = q.get('code');
        if (!code) {
          clearTimeout(fallbackTimer);
          router.replace('/auth/error?msg=' + encodeURIComponent('Geçersiz bağlantı'));
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // Farklı cihaz / in-app browser vakalarında sık: "code verifier" yok
          if (/code verifier/i.test(error.message)) {
            clearTimeout(fallbackTimer);
            router.replace('/login?verified=1');
            return;
          }
          clearTimeout(fallbackTimer);
          router.replace('/auth/error?msg=' + encodeURIComponent(error.message));
          return;
        }

        // 2) Oturum açıldı → (ops.) username’i profiles’a idempotent yaz
        const { data: u } = await supabase.auth.getUser();
        const uname = u.user?.user_metadata?.username as string | undefined;
        if (u.user?.id && uname) {
          await supabase.from('profiles').upsert(
            { id: u.user.id, username: uname },
            { onConflict: 'id' }
          );
        }

        clearTimeout(fallbackTimer);
        router.replace(next);
        router.refresh();
      } catch (e: any) {
        clearTimeout(fallbackTimer);
        const msg = e?.message || 'Beklenmeyen hata';
        router.replace('/auth/error?msg=' + encodeURIComponent(msg));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [supabase, router, q]);

  return (
    <div className="p-6 text-center">
      Doğrulama yapılıyor…
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Yükleniyor…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
