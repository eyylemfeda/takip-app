'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/i;

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get('next') || '/';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [emailOrUser, setEmailOrUser] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isVerify   = params.get('verify') === '1';    // "mailini kontrol et"
  const isVerified = params.get('verified') === '1';  // "mail doğrulandı, giriş yap"

  async function usernameToEmail(uname: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_email_by_username', {
      p_username: uname,
    });
    if (error) throw error;
    return (data as string) || null;
  }

  // ===== GİRİŞ =====
  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const ident = emailOrUser.trim();
      const emailToUse = ident.includes('@') ? ident : await usernameToEmail(ident);

      if (!emailToUse) {
        setErr('Kullanıcı bulunamadı.');
        setLoading(false);
        return;
      }

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });
      if (signErr) {
        setErr(signErr.message);
        setLoading(false);
        return;
      }

    const { data: u } = await supabase.auth.getUser();
    const uname = u.user?.user_metadata?.username as string | undefined;
    if (u.user?.id && uname) {
      await supabase
        .from('profiles')
        .upsert({ id: u.user.id, username: uname }, { onConflict: 'id' });
    }

      // Oturumun yazılmasını bekle (max ~4sn), sonra TAM SAYFA yönlendirme
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const { data } = await supabase.auth.getSession();
        if (data.session) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      window.location.replace(nextUrl);
      return;
    } catch (e: any) {
      setErr(e?.message ?? 'Giriş sırasında bir hata oluştu.');
      setLoading(false);
    }
  }

  // ===== KAYIT =====
  async function doSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const uname = username.trim();
      if (!USERNAME_RE.test(uname)) {
        setErr('Kullanıcı adı 3-20 karakter, harf/rakam/._- olmalı.');
        setLoading(false);
        return;
      }

      const origin = process.env.NEXT_PUBLIC_SITE_URL!;

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/auth/success`,
          data: { username: uname },
        },
      });
      if (signUpError) throw signUpError;

      // Kayıt sonrası: login moduna geç, e-postayı inputa yaz, şifreyi temizle
      setMode('login');
      setEmailOrUser(email.trim());
      setPassword('');

      // Bilgilendirme için verify=1 ile login'e yönlendir
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}&verify=1`);
      router.refresh();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/profiles_username_lower_key/i.test(msg)) {
        setErr('Bu kullanıcı adı alınmış. Lütfen başka bir kullanıcı adı deneyin.');
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">
          {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        </h1>

        {/* Bilgi bantları */}
        {mode === 'login' && isVerified && (
          <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            E-posta adresin doğrulandı. Lütfen giriş yap.
          </p>
        )}
        {mode === 'login' && !isVerified && isVerify && (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Kayıt tamamlandı. E-postandaki doğrulama bağlantısına tıkla, sonra giriş yap.
          </p>
        )}

        {mode === 'login' ? (
          <form onSubmit={doLogin} className="space-y-4">
            <input
              value={emailOrUser}
              onChange={(e) => setEmailOrUser(e.target.value)}
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

            <p className="text-center text-sm">
              Hesabın yok mu?{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => { setMode('signup'); setErr(null); }}
              >
                Kayıt Ol
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={doSignup} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="E-posta"
              autoComplete="email"
              required
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Kullanıcı adı (örn. hakan_34)"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Şifre"
              autoComplete="new-password"
              required
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-emerald-600 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? 'İşleniyor…' : 'Kayıt Ol'}
            </button>

            <p className="text-center text-sm">
              Zaten üye misin?{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => { setMode('login'); setErr(null); }}
              >
                Giriş Yap
              </button>
            </p>
          </form>
        )}
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
