'use client'; // Bu, onu bir Client Component yapar

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // (supabaseClient yolunuzu kontrol edin)
import { useRouter } from 'next/navigation';

export default function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    // Oturumdaki değişiklikleri dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {

        // Bu olay, token yenileme başarısız olduğunda (SIGNED_OUT)
        // veya kullanıcı manuel olarak çıkış yaptığında tetiklenir.
        if (event === 'SIGNED_OUT') {
          console.log('Oturum koptu (AuthListener), girişe yönlendiriliyor...');
          // Donmak yerine giriş sayfasına yönlendir
          router.push('/login'); // Giriş sayfanızın adresi
        }
      }
    );

    // Bileşen kaldırıldığında dinleyiciyi temizle
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  // Bu bileşen ekranda hiçbir şey göstermez
  return null;
}
