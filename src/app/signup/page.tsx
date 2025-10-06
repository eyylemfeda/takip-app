'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import nextDynamic from 'next/dynamic';

const SignupParams = nextDynamic(() => import('./SignupParams'), { ssr: false });

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/i;

export default function SignupPage() {
  const router = useRouter();

  const [code, setCode] = useState<string>('');
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 🔍 Daveti doğrula
  useEffect(() => {
    if (!code) return;
    (async () => {
      setChecking(true);
      try {
        const { data, error } = await supabase.rpc('check_invite', { p_code: code });
        if (error) throw error;
        const row = (data as any[])[0];
        if (row?.valid) {
          setValid(true);
          setEmail(row.email);
          setRole(row.role);
        } else {
          setValid(false);
          setReason(row?.reason || 'invalid');
        }
      } catch (e: any) {
        setValid(false);
        setReason(e?.message || 'invalid');
      } finally {
        setChecking(false);
      }
    })();
  }, [code]);

  async function checkUsernameAvailability(u: string) {
    if (!u || !USERNAME_RE.test(u)) {
      setUsernameOk(null);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        p_username: u,
      });
      if (error) throw error;
      setUsernameOk(!!data);
    } catch {
      setUsernameOk(null);
    }
  }

  // 📝 Kayıt işlemi
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!USERNAME_RE.test(username)) {
      setErr('Kullanıcı adı 3–20 karakter; harf, rakam, . _ -');
      return;
    }
    if (usernameOk === false) {
      setErr('Bu kullanıcı adı alınmış.');
      return;
    }
    if (!password || password.length < 6) {
      setErr('Şifre en az 6 karakter olmalı.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });
      if (error) throw error;

      if (data.session) {
        try {
          await supabase.rpc('claim_invite', { p_code: code, p_username: username });
        } catch (e) {
          console.warn('claim_invite failed:', e);
        }
        router.replace('/');
        router.refresh();
        return;
      }

      router.replace('/login?verify=1');
    } catch (e: any) {
      setErr(e?.message || 'Kayıt başarısız.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="p-6 text-sm text-gray-600">
        Davet kontrol ediliyor…
        <Suspense fallback={<div>Yükleniyor...</div>}>
          <SignupParams onFound={(c: string | null) => setCode(c || '')} />
        </Suspense>
      </main>
    );
  }

  if (!valid) {
    const msg =
      reason === 'expired'
        ? 'Davetin süresi dolmuş.'
        : reason === 'already_claimed'
        ? 'Bu davet daha önce kullanılmış.'
        : 'Geçersiz davet kodu.';
    return <main className="p-6 text-sm text-red-600">{msg}</main>;
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">Kayıt</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-700">E-posta</label>
            <input className="w-full rounded border px-3 py-2 bg-gray-50" value={email} readOnly />
          </div>

          <div>
            <label className="text-sm text-gray-700">Kullanıcı adı</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="ör. hakan_34"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.trim());
                setUsernameOk(null);
              }}
              onBlur={(e) => checkUsernameAvailability(e.target.value.trim())}
              required
            />
            {username && usernameOk === true && (
              <p className="mt-1 text-xs text-emerald-600">Uygun ✔</p>
            )}
            {username && usernameOk === false && (
              <p className="mt-1 text-xs text-red-600">Bu kullanıcı adı alınmış.</p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-700">Şifre</label>
            <input
              type="password"
              className="w-full rounded border px-3 py-2"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {role && (
            <p className="text-xs text-gray-500">
              Bu davet ile rolünüz: <span className="font-medium">{role}</span>
            </p>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-emerald-600 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Gönderiliyor…' : 'Kayıt Ol'}
          </button>
        </form>
      </div>
    </main>
  );
}
