'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Bu bileşen URL'deki parametreleri okuyup
 * session doğrulama işini üstlenir.
 */
export default function ResetParams({ onVerified }: { onVerified: (ok: boolean, err?: string) => void }) {
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        let ok = false;
        const code = params.get('code');
        const token_hash = params.get('token_hash');
        const type = (params.get('type') as 'recovery' | null) ?? null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          ok = !error;
        } else if (token_hash && (type === 'recovery' || !type)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'recovery',
          });
          ok = !error;
        } else {
          const { data } = await supabase.auth.getSession();
          ok = !!data.session;
        }

        if (ok) onVerified(true);
        else onVerified(false, 'Geçersiz veya süresi dolmuş bağlantı.');
      } catch (e: any) {
        onVerified(false, e?.message || 'Bağlantı doğrulanamadı.');
      }
    })();
  }, [params, onVerified]);

  return null; // sadece doğrulama yapıyor
}
