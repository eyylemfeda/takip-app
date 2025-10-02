'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Oturum ve aktiflik (profiles.is_active) kontrolü yapar.
 * - Oturum yoksa: /login?next=<mevcut_url>
 * - Oturum var ama aktif değilse: signOut + /login?err=not_allowed&next=<mevcut_url>
 * Dönüş:
 *  - uid: string | null  (null => henüz bilinmiyor, string => girişli kullanıcı id)
 *  - loading: boolean    (true => kontrol yapılıyor / redirect atıldı)
 */
export function useRequireActiveUser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Mevcut tam yolu next için üret
  const nextUrl = useMemo(() => {
    const qs = params?.toString() ?? '';
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, params]);

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1) Oturum var mı?
      const { data: sessionData } = await supabase.auth.getSession();
      const id = sessionData.session?.user?.id ?? null;

      if (!id) {
        if (!cancelled) {
          setUid(null);
          setLoading(false);
          router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
        }
        return;
      }

      // 2) Aktiflik kontrolü
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', id)
        .maybeSingle();

      if (!prof?.is_active) {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUid(null);
          setLoading(false);
          router.replace(`/login?err=not_allowed&next=${encodeURIComponent(nextUrl)}`);
        }
        return;
      }

      // 3) Giriş + aktif
      if (!cancelled) {
        setUid(id);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, nextUrl]);

  return { uid, loading };
}
