'use client';

import { useEffect, useState } from 'react';
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

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  // nextUrl'i client tarafında hesapla (bu önemli)
  useEffect(() => {
    const qs = params?.toString() ?? '';
    const fullUrl = qs ? `${pathname}?${qs}` : pathname;
    setNextUrl(fullUrl);
  }, [pathname, params]);

  useEffect(() => {
    if (!nextUrl) return; // nextUrl hazır değilse bekle
    let cancelled = false;

    (async () => {
      setLoading(true);

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
