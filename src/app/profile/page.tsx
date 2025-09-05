'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** DB satırı için referans tip (okuma amaçlı) */
type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_goal: number | null;
  is_admin: boolean | null;
};

/** Formda tutulacak alanlar */
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
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState<string>('');

  // oturum + profil yükleme
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u?.id) return;

      setUid(u.id);
      setEmail(u.email ?? '');

      // profil satırı yoksa oluştur (idempotent)
      await supabase.from('profiles').upsert({ id: u.id }, { onConflict: 'id' });

      // profil verisini çek
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, daily_goal')
        .eq('id', u.id)
        .maybeSingle();

      if (p) {
        setForm({
          full_name: p.full_name ?? '',
          avatar_url: p.avatar_url ?? '',
        });
        setDailyGoal(p.daily_goal ?? null);
        setGoalInput(p.daily_goal != null ? String(p.daily_goal) : '');
      }
    })();
  }, [supabase]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;

    setBusy(true);
    setMsg('');
    try {
      const updates = {
        full_name: form.full_name.trim(),
        avatar_url: form.avatar_url.trim() || null,
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', uid);
      if (error) throw error;
      setMsg('Profil güncellendi ✅');
      window.dispatchEvent(new Event('profile:changed')); // HeaderBar dinleyecek
      router.refresh();                                   // SSR kısımlar tazelensin

    } catch (err: any) {
      setMsg(err?.message ?? 'Profil kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDailyGoal() {
    if (!uid) return;
    setBusy(true);
    setMsg('');
    try {
      const raw = goalInput.trim();
      const nextVal = raw === '' ? null : Number(raw);
      if (raw !== '' && Number.isNaN(nextVal)) throw new Error('Geçerli bir sayı girin.');
      const { error } = await supabase.from('profiles').update({ daily_goal: nextVal }).eq('id', uid);
      if (error) throw error;
      setDailyGoal(nextVal);
      setMsg('Günlük hedef güncellendi.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Hedef kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>
      {email && <p className="text-sm text-gray-500">E-posta: {email}</p>}

      <form onSubmit={saveProfile} className="rounded-xl border bg-white p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Ad Soyad</label>
          <input
            value={form.full_name}
            onChange={(e) =>
              setForm((f: ProfileForm) => ({ ...f, full_name: e.target.value }))
            }
            className="w-full rounded border px-3 py-2"
            placeholder="Ad Soyad"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Avatar URL</label>
          <input
            value={form.avatar_url}
            onChange={(e) =>
              setForm((f: ProfileForm) => ({ ...f, avatar_url: e.target.value }))
            }
            className="w-full rounded border px-3 py-2"
            placeholder="https://..."
          />
          <input ref={fileRef} type="file" className="hidden" />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? 'Kaydediliyor…' : 'Profili Kaydet'}
        </button>
      </form>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <label className="block text-sm font-medium">Günlük Soru Hedefi</label>
        <div className="flex items-center gap-2">
          <input
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            inputMode="numeric"
            className="w-32 rounded border px-3 py-2"
            placeholder="örn. 100"
          />
          <button
            onClick={saveDailyGoal}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? 'Kaydediliyor…' : 'Hedefi Kaydet'}
          </button>
          {dailyGoal != null && (
            <span className="text-sm text-gray-600">Mevcut: {dailyGoal}</span>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </main>
  );
}
