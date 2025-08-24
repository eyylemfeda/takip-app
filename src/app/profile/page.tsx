'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const [uid, setUid] = useState<string>();
  const [email, setEmail] = useState<string>('');
  const [form, setForm] = useState<Profile>({ full_name: '', avatar_url: '' });
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

      // profil yoksa oluştur
      await supabase.from('profiles').upsert({ id: u.id }, { onConflict: 'id' });

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, daily_goal')
        .eq('id', u.id)
        .maybeSingle();

      if (p) {
        setForm(p as Profile);
        setDailyGoal(p.daily_goal ?? null);
        setGoalInput(p.daily_goal?.toString() ?? '');
      }
    })();
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name || null, updated_at: new Date().toISOString() })
      .eq('id', uid);
    setBusy(false);
    setMsg(error ? 'Kaydedilemedi: ' + error.message : 'Kaydedildi ✅');
  }

  async function uploadAvatar(file: File) {
    if (!uid) return;
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (error) throw error;

      setForm((f) => ({ ...f, avatar_url: publicUrl }));
      setMsg('Avatar güncellendi ✅');
    } catch (e: any) {
      setMsg('Yükleme hatası: ' + (e?.message || e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setMsg('Dosya çok büyük (max 3MB).');
      e.currentTarget.value = '';
      return;
    }
    uploadAvatar(file);
  }

  async function clearAvatar() {
    if (!uid) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', uid);
    setBusy(false);
    if (error) setMsg('Avatar kaldırılamadı: ' + error.message);
    else {
      setForm((f) => ({ ...f, avatar_url: null }));
      setMsg('Avatar kaldırıldı.');
    }
  }

  async function saveGoal() {
    if (!uid) return;
    const parsed = parseInt(goalInput);
    if (isNaN(parsed) || parsed <= 0) {
      setMsg('Geçerli bir sayı girin.');
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ daily_goal: parsed, updated_at: new Date().toISOString() })
      .eq('id', uid);
    setBusy(false);

    if (error) {
      setMsg('Hedef kaydedilemedi: ' + error.message);
    } else {
      setDailyGoal(parsed);
      setMsg('Günlük hedef kaydedildi ✅');
    }
  }

  if (!uid) {
    return (
      <main className="p-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">
          Giriş yap
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>

      {/* Avatar kartı */}
      <section className="rounded-xl border bg-white p-4 shadow-sm max-w-md space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 overflow-hidden rounded-full border bg-gray-100">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-2xl">👤</span>
            )}
          </div>

          <div className="space-x-2">
            <label className="inline-block cursor-pointer rounded-lg border px-3 py-2 hover:bg-gray-50">
              Resim Yükle
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </label>
            {form.avatar_url && (
              <button onClick={clearAvatar} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
                Kaldır
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600">Öneri: .jpg/.png, max 3MB.</p>
      </section>

      {/* Ad soyad kartı */}
      <section className="rounded-xl border bg-white p-4 shadow-sm max-w-md space-y-4">
        <div className="text-sm text-gray-600">
          E-posta: <b>{email}</b>
        </div>

        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="text-sm">Ad Soyad</label>
            <input
              className="w-full rounded-lg border p-2"
              placeholder="Ad Soyad"
              value={form.full_name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>

          <button
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      </section>

      {/* Günlük hedef kartı */}
      <section className="rounded-xl border bg-white p-4 shadow-sm max-w-md space-y-3">
        <label className="text-sm font-medium text-gray-700">Günlük Soru Hedefin</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className="w-32 rounded border p-2"
            placeholder="Örn. 100"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
          />
          <button
            onClick={saveGoal}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </section>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </main>
  );
}
