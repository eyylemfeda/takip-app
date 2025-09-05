'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** DB satırı (okuma amaçlı) */
type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_goal: number | null;
  is_admin: boolean | null;
};

/** Form state */
type ProfileForm = {
  full_name: string;
  avatar_url: string;
};

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [uid, setUid] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  const [form, setForm] = useState<ProfileForm>({ full_name: '', avatar_url: '' });
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState<string>('');

  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const [loading, setLoading] = useState(true);     // sayfa ilk yükleme
  const [ready, setReady] = useState(false);        // uid/profil hazır mı
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyGoal, setBusyGoal] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  // --- Profili yükle (stabil akış, focus/refresh döngüsü yok) ---
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr('');
      setMsg('');

      try {
        // 1) Oturum
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user;
        if (!u?.id) {
          if (!cancelled) {
            setErr('Oturum bulunamadı.');
            setReady(false);
          }
          return;
        }

        if (cancelled) return;
        setUid(u.id);
        setEmail(u.email ?? '');

        // 2) Profil satırı yoksa oluştur (idempotent)
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert({ id: u.id }, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;

        // 3) Profil verisini çek
        const { data: p, error: selErr } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, daily_goal')
          .eq('id', u.id)
          .maybeSingle();
        if (selErr) throw selErr;

        if (cancelled) return;

        setForm({
          full_name: p?.full_name ?? '',
          avatar_url: p?.avatar_url ?? '',
        });
        setDailyGoal(p?.daily_goal ?? null);
        setGoalInput(p?.daily_goal != null ? String(p?.daily_goal) : '');
        setReady(true);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Profil yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  // --- Profil kaydet ---
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !ready || busyProfile) return;

    setBusyProfile(true);
    setMsg('');
    setErr('');
    try {
      const updates = {
        id: uid,
        full_name: form.full_name.trim(),
        avatar_url: form.avatar_url.trim() || null,
      };
      // upsert: gerekirse satırı oluştur
      const { error } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' });
      if (error) throw error;

      setMsg('Profil güncellendi ✅');
      // HeaderBar hemen güncellesin
      window.dispatchEvent(new Event('profile:changed'));
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Profil kaydedilemedi.');
    } finally {
      setBusyProfile(false);
    }
  }

  // --- Günlük hedef kaydet ---
  async function saveDailyGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !ready || busyGoal) return;

    setBusyGoal(true);
    setMsg('');
    setErr('');
    try {
      const raw = goalInput.trim();
      const nextVal = raw === '' ? null : Number(raw);
      if (raw !== '' && Number.isNaN(nextVal)) throw new Error('Geçerli bir sayı girin.');

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: uid, daily_goal: nextVal }, { onConflict: 'id' });
      if (error) throw error;

      setDailyGoal(nextVal);
      setMsg('Günlük hedef güncellendi ✅');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Hedef kaydedilemedi.');
    } finally {
      setBusyGoal(false);
    }
  }

  // --- Yükleniyor görünümü (hata varsa göster) ---
  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border bg-white p-6 shadow">
          <p>Yükleniyor…</p>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>
      {email && <p className="text-sm text-gray-500">E-posta: {email}</p>}

      {/* Profil formu */}
      <form onSubmit={saveProfile} className="rounded-xl border bg-white p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Ad Soyad</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full rounded border px-3 py-2"
            placeholder="Ad Soyad"
            disabled={!ready || busyProfile}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Avatar URL</label>
          <input
            value={form.avatar_url}
            onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
            className="w-full rounded border px-3 py-2"
            placeholder="https://..."
            disabled={!ready || busyProfile}
          />
          <input ref={fileRef} type="file" className="hidden" />
        </div>

        <button
          type="submit"
          disabled={!ready || busyProfile}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busyProfile ? 'Kaydediliyor…' : 'Profili Kaydet'}
        </button>
      </form>

      {/* Günlük hedef formu */}
      <form onSubmit={saveDailyGoal} className="rounded-xl border bg-white p-4 space-y-3">
        <label className="block text-sm font-medium">Günlük Soru Hedefi</label>
        <div className="flex items-center gap-2">
          <input
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-32 rounded border px-3 py-2"
            placeholder="örn. 100"
            disabled={!ready || busyGoal}
          />
          <button
            type="submit"
            disabled={!ready || busyGoal}
            className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busyGoal ? 'Kaydediliyor…' : 'Hedefi Kaydet'}
          </button>
          {dailyGoal != null && (
            <span className="text-sm text-gray-600">Mevcut: {dailyGoal}</span>
          )}
        </div>
      </form>

      {/* Mesajlar */}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </main>
  );
}
