'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// Kullanıcı adı regex (güvenlik için minimum kontrol)
const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/i;

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const nextUrl = params.get('next') || '/';

  const [ident, setIdent] = useState('');      // e-posta veya kullanıcı adı
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // username → email çeviren RPC (anon erişimli)
  async function usernameToEmail(uname: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_email_by_username', {
      p_username: uname,
    });
    if (error) throw error;
    return (data as string) || null;
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const raw = ident.trim();

      // 1) Kimliği belirle: e-posta mı kullanıcı adı mı?
      let emailToUse: string | null;
      if (raw.includes('@')) {
        emailToUse = raw;
      } else {
        if (!USERNAME_RE.test(raw)) {
          setErr('Geçerli bir kullanıcı adı veya e-posta girin.');
          setLoading(false);
          return;
        }
        emailToUse = await usernameToEmail(raw);
      }

      if (!emailToUse) {
        setErr('Kullanıcı bulunamadı.');
        setLoading(false);
        return;
      }

      // 2) Şifre ile giriş
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });
      if (signErr) {
        setErr(signErr.message);
        setLoading(false);
        return;
      }

            // 4) Tam sayfa yönlendirme
      router.push(nextUrl);
    } catch (e: any) {
      setErr(e?.message ?? 'Giriş sırasında bir hata oluştu.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">Giriş Yap</h1>

        <form onSubmit={doLogin} className="space-y-4">
          <input
            value={ident}
            onChange={(e) => setIdent(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="E-posta veya kullanıcı adı"
            autoComplete="username"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Şifre"
            autoComplete="current-password"
            required
          />

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'İşleniyor…' : 'Giriş Yap'}
          </button>

          {/* Buraya eklediğimiz bölüm ile şifre sıfırlama isteği gönderiyoruz */}
          <p className="mt-3 text-center text-sm">
            Şifreni mi unuttun?{' '}
            <a href="/forgot" className="text-blue-600 underline">Sıfırla</a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-gray-600">Yükleniyor…</div>}>
      <LoginInner />
    </Suspense>
  );
}
