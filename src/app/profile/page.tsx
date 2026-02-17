'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';
import UsernameField from '@/app/components/UsernameField';
import {
  Camera,
  Save,
  Target,
  Lock,
  User,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Form tipleri
type ProfileForm = {
  full_name: string | null;
  avatar_url: string | null;
  role: string | null; // Rol bilgisini de tutuyoruz
};

export default function ProfilePage() {
  // 1) Giriş + aktiflik kontrolü
  const { uid, loading } = useRequireActiveUser();

  // 2) State Tanımları
  const [email, setEmail] = useState<string>('');
  const [form, setForm] = useState<ProfileForm>({ full_name: null, avatar_url: null, role: null });

  // Günlük Hedef State'leri
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState<string>('');

  // Şifre Değiştirme State'leri
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI State'leri
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 3) Verileri Yükle
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    (async () => {
      // E-posta al
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (cancelled) return;
      setEmail(u?.email ?? '');

      // Profil yoksa oluştur (Upsert)
      await supabase.from('profiles').upsert({ id: uid }, { onConflict: 'id' });

      // Profili oku (role bilgisini de çekiyoruz)
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, daily_goal, role')
        .eq('id', uid)
        .maybeSingle();

      if (cancelled) return;

      if (p) {
        setForm({
          full_name: (p as any).full_name ?? null,
          avatar_url: (p as any).avatar_url ?? null,
          role: (p as any).role ?? 'student', // Varsayılan student
        });

        const dg = (p as any).daily_goal as number | null;
        setDailyGoal(dg ?? null);
        setGoalInput(dg ? String(dg) : '');
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  // Yardımcı: Mesaj Göster
  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // 4) Kaydet: Ad-Soyad
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name || null, updated_at: new Date().toISOString() })
      .eq('id', uid);
    setBusy(false);

    if (error) showMsg('Kaydedilemedi: ' + error.message, 'error');
    else showMsg('Profil bilgileri güncellendi.');
  }

  // 5) Avatar İşlemleri
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
      showMsg('Profil fotoğrafı güncellendi.');
    } catch (e: any) {
      showMsg('Yükleme hatası: ' + (e?.message || e), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showMsg('Dosya çok büyük (max 3MB).', 'error');
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
    if (error) showMsg('Avatar kaldırılamadı.', 'error');
    else {
      setForm((f) => ({ ...f, avatar_url: null }));
      showMsg('Profil fotoğrafı kaldırıldı.');
    }
  }

  // 6) Günlük Hedef Kaydet
  async function saveGoal() {
    if (!uid) return;
    const parsed = parseInt(goalInput);
    if (isNaN(parsed) || parsed <= 0) {
      showMsg('Geçerli bir sayı girin.', 'error');
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ daily_goal: parsed, updated_at: new Date().toISOString() })
      .eq('id', uid);
    setBusy(false);

    if (error) showMsg('Hedef kaydedilemedi.', 'error');
    else {
      setDailyGoal(parsed);
      showMsg('Günlük hedef güncellendi.');
    }
  }

  // 7) Şifre Değiştirme (YENİ)
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
        showMsg('Şifre en az 6 karakter olmalı.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMsg('Şifreler eşleşmiyor.', 'error');
        return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    if (error) {
        showMsg('Hata: ' + error.message, 'error');
    } else {
        showMsg('Şifreniz başarıyla değiştirildi.');
        setNewPassword('');
        setConfirmPassword('');
    }
  }

  if (loading) return <div className="p-10 text-center text-gray-500">Yükleniyor...</div>;
  if (!uid) return null;

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">

      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Profil Ayarları</h1>
            <p className="text-gray-500 text-sm mt-1">Hesap bilgilerinizi ve tercihlerinizi yönetin.</p>
        </div>
        {msg && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-fade-in
                ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
            `}>
                {msg.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                {msg.text}
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* SOL KOLON: Kişisel Bilgiler */}
        <div className="space-y-6">

            {/* AVATAR KARTI */}
            <section className="bg-white rounded-xl border p-6 shadow-sm flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100">
                        {form.avatar_url ? (
                            <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full grid place-items-center text-4xl text-gray-400">👤</div>
                        )}
                    </div>
                    {/* Hover ile ikon gösterme opsiyonel */}
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                        <Camera size={18} />
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    </label>
                </div>

                <div>
                    <h2 className="font-semibold text-lg">{form.full_name || 'İsimsiz Kullanıcı'}</h2>
                    <p className="text-sm text-gray-500">{email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full uppercase font-bold tracking-wide">
                        {form.role === 'student' ? 'Öğrenci' : form.role === 'coach' ? 'Eğitmen' : 'Yönetici'}
                    </span>
                </div>

                {form.avatar_url && (
                    <button onClick={clearAvatar} className="text-xs text-red-600 hover:text-red-700 underline">
                        Fotoğrafı Kaldır
                    </button>
                )}
            </section>

            {/* KİMLİK BİLGİLERİ */}
            <section className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-semibold border-b pb-2 mb-2">
                    <User size={20} />
                    <h3>Kimlik Bilgileri</h3>
                </div>

                {/* Kullanıcı Adı Component'i */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Kullanıcı Adı</label>
                    <UsernameField />
                </div>

                {/* Ad Soyad Formu */}
                <form onSubmit={saveName} className="space-y-3 pt-2">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Ad Soyad</label>
                        <input
                            className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Adınız Soyadınız"
                            value={form.full_name ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                        />
                    </div>
                    <button
                        disabled={busy}
                        className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {busy ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Kaydet
                    </button>
                </form>
            </section>
        </div>


        {/* SAĞ KOLON: Ayarlar & Güvenlik */}
        <div className="space-y-6">

            {/* GÜNLÜK HEDEF (SADECE ÖĞRENCİLER İÇİN) */}
            {form.role === 'student' && (
                <section className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-gray-700 font-semibold border-b pb-2 mb-2">
                        <Target size={20} className="text-red-500" />
                        <h3>Günlük Hedef</h3>
                    </div>

                    <p className="text-sm text-gray-500">
                        Günlük çözmek istediğiniz soru sayısını belirleyin. Bu hedef ana sayfadaki ilerleme çubuğunuzu etkiler.
                    </p>

                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={1}
                            className="flex-1 rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="Örn. 100"
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value)}
                        />
                        <button
                            onClick={saveGoal}
                            disabled={busy}
                            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
                        >
                            Güncelle
                        </button>
                    </div>
                </section>
            )}

            {/* GÜVENLİK / ŞİFRE DEĞİŞTİRME (YENİ) */}
            <section className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-semibold border-b pb-2 mb-2">
                    <Lock size={20} className="text-gray-600" />
                    <h3>Şifre Değiştir</h3>
                </div>

                <form onSubmit={updatePassword} className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Yeni Şifre</label>
                        <input
                            type="password"
                            className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-gray-400 outline-none"
                            placeholder="******"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Şifre Tekrar</label>
                        <input
                            type="password"
                            className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-gray-400 outline-none"
                            placeholder="******"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={busy || !newPassword}
                        className="w-full flex justify-center items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-white font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
                    >
                        {busy ? <Loader2 className="animate-spin" size={18} /> : 'Şifreyi Güncelle'}
                    </button>
                </form>
            </section>
        </div>

      </div>
    </main>
  );
}
