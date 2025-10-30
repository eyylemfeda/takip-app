'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

// Gerekli tüm profil bilgilerini ekledik
type Profile = {
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

// Context'in tipini (Bu değişmedi)
type AuthContextType = {
  session: Session | null;
  uid: string | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  uid: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Yüklenme durumu
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. SADECE SAYFA İLK YÜKLENDİĞİNDE çalışır
    // (Login sonrası 'window.location.replace'  bunu tetikler)
    async function getInitialSession() {
      // Önce oturumu al
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session) {
        // Oturum varsa, profili de al
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        setSession(session);
        setUid(session.user.id);
        setProfile(profile);
      }

      // Her durumda (oturum olsa da olmasa da) yükleme bitti.
      setLoading(false);
    }

    getInitialSession();

    // 2. SADECE ÇIKIŞ YAPMAYI (SIGNED_OUT) dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // 'SIGNED_IN' (Giriş) olayını dinlemiyoruz,
        // çünkü o 'yarış durumu' yaratıyordu.

        if (event === 'SIGNED_OUT') {
          console.log('Oturum koptu, girişe yönlendiriliyor...');
          setSession(null);
          setUid(null);
          setProfile(null);
          if (pathname !== '/login') {
            router.push('/login');
          }
        }
      }
    );

    // Dinleyiciyi temizle
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router, pathname]); // Bu useEffect sadece 1 kez çalışır

  const value = { session, uid, profile, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook'umuz (useAuth) değişmedi
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  }
  return context;
};
