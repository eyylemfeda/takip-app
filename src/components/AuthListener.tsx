'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation'; // 1. usePathname'i import et

export default function AuthListener() {
  const router = useRouter();
  const pathname = usePathname(); // 2. Mevcut sayfanın yolunu (path) al

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {

        // Oturum kapalıysa (SIGNED_OUT)
        if (event === 'SIGNED_OUT') {
          console.log('Oturum koptu (AuthListener), yol kontrol ediliyor...');

          // 3. YALNIZCA /login sayfasında DEĞİLSEK yönlendir.
          // Bu, sonsuz döngüyü engeller.
          if (pathname !== '/login') {
            console.log('Giriş sayfasında değiliz, yönlendiriliyor...');
            router.push('/login');
          }
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };

  // 4. router VE pathname'i bağımlılıklara ekle
  }, [router, pathname]);

  // Bu bileşen ekranda hiçbir şey göstermez
  return null;
}
