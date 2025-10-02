'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const next = params.get('next') || '/';

      // Davet akışı parametreleri: /auth/callback?invite=...&username=...
      const invite = params.get('invite');
      const uname  = params.get('username') || null;

      let ok = false;
      let errMsg = 'Geçersiz bağlantı';

      try {
        // 1) Supabase V2: ?code=...  → exchangeCodeForSession
        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) ok = true;
          else errMsg = error.message;
        } else {
          // 2) E-posta doğrulama/magic link: ?token_hash=...&type=signup|magiclink|recovery|invite|email_change
          const token_hash = params.get('token_hash');
          const type = (params.get('type') as
            | 'signup'
            | 'magiclink'
            | 'recovery'
            | 'invite'
            | 'email_change'
            | null) ?? 'signup';

          if (token_hash) {
            const { error } = await supabase.auth.verifyOtp({ token_hash, type });
            if (!error) ok = true;
            else errMsg = error.message;
          } else {
            // 3) Son çare: halihazırda bir session var mı?
            const { data } = await supabase.auth.getSession();
            if (data.session) ok = true;
          }
        }

        // 4) Oturum kurulduysa daveti finalize et (idempotent; hata verirse akışı bozmayalım)
        if (ok && invite) {
          try {
            await supabase.rpc('claim_invite', { p_code: invite, p_username: uname });
          } catch (e) {
            // İsteğe bağlı: loglamak istersen
            console.warn('claim_invite failed:', e);
          }
        }
      } catch (e: any) {
        errMsg = e?.message ?? String(e);
      }

      // 5) Yönlendir
      router.replace(ok ? next : `/auth/error?msg=${encodeURIComponent(errMsg)}`);
    })();
  }, [params, router]);

  return <p className="p-4 text-center text-sm text-gray-600">Doğrulama tamamlanıyor…</p>;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-sm text-gray-600">Yükleniyor…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
