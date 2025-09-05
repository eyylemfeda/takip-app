'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const q = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const next = q.get('next') || '/auth/success';

        // 0) Zaten oturum varsa direkt devam
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          const { data: u } = await supabase.auth.getUser();
          const uname = u.user?.user_metadata?.username as string | undefined;
          if (u.user?.id && uname) {
            await supabase.from('profiles').upsert({ id: u.user.id, username: uname }, { onConflict: 'id' });
          }
          router.replace(next);
          router.refresh();
          return;
        }

        // 1) URL'deki code ile oturum açmayı dene
        const code = q.get('code');
        if (!code) throw new Error('Geçersiz bağlantı');

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          // Farklı cihazdan açıldığında sık görülen hata: code verifier yok
          if (/code verifier/i.test(error.message)) {
            // e-posta Supabase tarafında doğrulandı; kullanıcıdan giriş yapmasını iste
            router.replace('/login?verified=1');
            return;
          }
          // Diğer hatalarda hata sayfasına düş
          router.replace(`/auth/error?msg=${encodeURIComponent(error.message)}`);
          return;
        }

        // 2) Oturum açıldıysa profil satırını idempotent güncelle
        const { data: u } = await supabase.auth.getUser();
        const uname = u.user?.user_metadata?.username as string | undefined;
        if (u.user?.id && uname) {
          await supabase.from('profiles').upsert({ id: u.user.id, username: uname }, { onConflict: 'id' });
        }

        router.replace(next);
        router.refresh();
      } catch (e: any) {
        const msg = e?.message || 'Beklenmeyen hata';
        router.replace(`/auth/error?msg=${encodeURIComponent(msg)}`);
      }
    })();
  }, [supabase, router, q]);

  return <div className="p-6 text-center">Doğrulama yapılıyor…</div>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Yükleniyor…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
