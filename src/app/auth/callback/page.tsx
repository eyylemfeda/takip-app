'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Bu sayfa her seferinde dinamik çalışsın
export const dynamic = 'force-dynamic';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const next = params.get('next') || '/';

      let ok = false;
      let errMsg = 'Geçersiz bağlantı';

      try {
        // 1) Supabase V2: ?code=... → exchangeCodeForSession
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
            // 3) Son çare: Zaten session var mı? (bazı istemciler linkten dönerken set etmiş olabilir)
            const { data } = await supabase.auth.getSession();
            if (data.session) ok = true;
          }
        }
      } catch (e: any) {
        errMsg = e?.message ?? String(e);
      }

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
