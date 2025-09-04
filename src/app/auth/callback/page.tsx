'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const next = params.get('next') || '/';
      let ok = false;
      let errMsg = 'Geçersiz bağlantı';

      const code = params.get('code');                 // PKCE (aynı cihaz)
      const token_hash = params.get('token_hash');     // OTP (cihazdan bağımsız)
      const typeParam = params.get('type') as
        | 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | null;
      const type = typeParam ?? 'signup';

      try {
        if (token_hash) {
          // ✅ Cross-device güvenli yol
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          ok = !error; if (error) errMsg = error.message;
        } else if (code) {
          // PKCE dene (aynı cihaz akışı)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          ok = !error; if (error) errMsg = error.message;
        } else {
          // Yedek: zaten oturum var mı?
          const { data } = await supabase.auth.getSession();
          ok = !!data.session;
        }

        if (ok) {
          // Doğrulama olduysa username'i profiline yaz (idempotent)
          const { data: ures } = await supabase.auth.getUser();
          const u = ures.user;
          const uname = u?.user_metadata?.username?.trim();
          if (u?.id && uname) {
            await supabase
              .from('profiles')
              .upsert({ id: u.id, username: uname }, { onConflict: 'id' });
          }
        }
      } catch (e: any) {
        errMsg = e?.message ?? String(e);
      }

      if (!mounted) return;
      // Hata sayfasına da next'i taşı
      router.replace(ok ? next : `/auth/error?msg=${encodeURIComponent(errMsg)}&next=${encodeURIComponent(next)}`);
    })();

    return () => { mounted = false; };
  }, [params, router, supabase]);

  return <p className="p-4 text-center text-sm text-gray-600">Doğrulama tamamlanıyor…</p>;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-sm text-gray-600">Yükleniyor…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
