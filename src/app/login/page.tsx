'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
      else router.replace('/');
      return;
    }

    // === SIGN UP ===
    const origin =
  (typeof window !== 'undefined' && window.location.origin) ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://takip-app.vercel.app';

const { data, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${origin}/auth/callback?next=/auth/success`,
  },
});

if (signUpError) {
  setErr(signUpError.message);
  return;
}

    // Profil satırı aç (idempotent)
    const userId = data.user?.id;
    if (userId) {
      await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id' });
    }

    alert('Kayıt başarılı! E-postandaki doğrulama bağlantısına tıkla, sonra otomatik giriş yapılacak.');
    router.replace('/'); // istersen burada /login bırakıp “mailini kontrol et” ekranı gösterebilirsin
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        </h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta"
            className="w-full border rounded p-2"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="w-full border rounded p-2"
            required
          />

          {err && <p className="text-red-500 text-sm">{err}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700"
          >
            {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'login' ? (
            <p>
              Hesabın yok mu?{' '}
              <button className="text-blue-600 underline" onClick={() => setMode('signup')}>
                Kayıt Ol
              </button>
            </p>
          ) : (
            <p>
              Zaten üye misin?{' '}
              <button className="text-blue-600 underline" onClick={() => setMode('login')}>
                Giriş Yap
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
