'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';

const ResetParams = dynamic(() => import('./ResetParams'), { ssr: false });

export default function ResetPasswordPage() {
  const router = useRouter();

  const [verifying, setVerifying] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function handleVerified(ok: boolean, error?: string) {
    setVerifying(false);
    setSessionOk(ok);
    if (!ok && error) setErr(error);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!pwd1 || pwd1.length < 6) {
      setErr('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (pwd1 !== pwd2) {
      setErr('Şifreler eşleşmiyor.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;

      setMsg('Şifren güncellendi.');
      await supabase.auth.signOut({ scope: 'global' });
      setTimeout(() => router.replace('/login?reset=1'), 600);
    } catch (e: any) {
      setErr(e?.message || 'Şifre güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (verifying) {
    return (
      <main className="p-6 text-sm text-gray-600">
        Bağlantı doğrulanıyor…
        <Suspense fallback={<div>Kontrol ediliyor...</div>}>
          <ResetParams onVerified={handleVerified} />
        </Suspense>
      </main>
    );
  }

  if (!sessionOk) {
    return <main className="p-6 text-sm text-red-600">{err || 'Geçersiz bağlantı.'}</main>;
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">Yeni Şifre</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="Yeni şifre"
            value={pwd1}
            onChange={(e) => setPwd1(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="Yeni şifre (tekrar)"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            required
          />

          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-emerald-600 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
          </button>
        </form>
      </div>
    </main>
  );
}
