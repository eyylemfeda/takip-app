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

// Context'in tipini güncelledik
type AuthContextType = {
  session: Session | null;
  uid: string | null;
  profile: Profile | null; // <-- 'role', 'full_name' vb. hepsi burada
  loading: boolean;
};

// Context'i oluşturuyoruz
const AuthContext = createContext<AuthContextType>({
  session: null,
  uid: null,
  profile: null, // <-- Güncellendi
  loading: true,
});

// Provider bileşenini güncelliyoruz
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // <-- Güncellendi
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Sayfa ilk yüklendiğinde mevcut oturumu KONTROL ET
    async function getInitialSession() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session) {
        setSession(session);
        setUid(session.user.id);
        // Oturum varsa, profili de al (role, full_name, avatar_url)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', session.user.id)
          .single();
        setProfile(profile);
      }
      setLoading(false); // İlk kontrol bitti
    }

    getInitialSession();

    // 2. Oturumdaki DEĞİŞİKLİKLERİ dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setLoading(true);
        setSession(newSession);
        setUid(newSession?.user?.id ?? null);

        if (event === 'SIGNED_IN' && newSession) {
          // Kullanıcı GİRİŞ YAPTI, profilini al
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', newSession.user.id)
            .single();
          setProfile(profile);

        } else if (event === 'SIGNED_OUT') {
          // Kullanıcı ÇIKIŞ YAPTI, profili temizle
          setProfile(null);
          if (pathname !== '/login') {
            router.push('/login');
          }
        }
        setLoading(false);
      }
    );

    // Dinleyiciyi temizle
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router, pathname]);

  // Context'in değerini oluştur
  const value = {
    session,
    uid,
    profile, // <-- Güncellendi
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook'umuz (useAuth) artık tüm profil bilgilerini döndürecek
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  }
  return context;
};
