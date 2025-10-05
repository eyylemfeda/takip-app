'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Oturum ve aktiflik (profiles.is_active) kontrolü yapar.
 * - Oturum yoksa: /login?next=<mevcut_url>
 * - Oturum var ama aktif değilse: signOut + /login?err=not_allowed&next=<mevcut_url>
 */
export function useRequireActiveUser() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const getNextUrl = () => {
      if (typeof window === 'undefined') return '/';
      return window.location.pathname + window.location.search;
    };

    (async () => {
      setLoading(true);

      // 1) Oturum var mı?
      const { data: sessionData } = await supabase.auth.getSession();
      const id = sessionData.session?.user?.id ?? null;

      if (!id) {
        if (!cancelled) {
          setUid(null);
          setLoading(false);
          router.replace(`/login?next=${encodeURIComponent(getNextUrl())}`);
        }
        return;
      }

      // 2) Aktiflik
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
          router.replace(
            `/login?err=not_allowed&next=${encodeURIComponent(getNextUrl())}`
          );
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
  }, [router]);

  return { uid, loading };
}
