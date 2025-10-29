'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // supabaseClient yolunuzu kontrol edin
import { useRouter, usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

// Context'in tipini belirliyoruz
type AuthContextType = {
  session: Session | null;
  uid: string | null;
  loading: boolean;
};

// Context'i oluşturuyoruz
const AuthContext = createContext<AuthContextType>({
  session: null,
  uid: null,
  loading: true, // Başlangıçta her zaman yükleniyor
});

// Provider bileşenini oluşturuyoruz
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Yüklenme durumu
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Sayfa ilk yüklendiğinde mevcut oturumu bir kez kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUid(session?.user?.id ?? null);
      setLoading(false); // İlk kontrol bitti, yüklenme tamamlandı
    });

    // 2. Oturumdaki değişiklikleri (Giriş, Çıkış) dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUid(newSession?.user?.id ?? null);

        // Oturum kapandıysa (SIGNED_OUT) ve giriş sayfasında değilsek
        if (event === 'SIGNED_OUT' && pathname !== '/login') {
          console.log('Oturum koptu, girişe yönlendiriliyor...');
          router.push('/login');
        }
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
    loading,
  };

  // Yüklenme bitene kadar (veya yönlendirme yapılana kadar)
  // alt bileşenleri (children) gösterme
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Kendi Hook'umuzu oluşturuyoruz (diğer sayfalarda bunu kullanacağız)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  }
  return context;
};
