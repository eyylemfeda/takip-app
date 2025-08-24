'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subject_id: string; created_at: string };

export default function AdminTopicsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>('');

  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopicName, setNewTopicName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>();

  // auth + admin check + dersleri getir
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;

      // profile → is_admin
      const { data: p } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', uid)
        .maybeSingle();
      const admin = !!p?.is_admin;
      setIsAdmin(admin);

      // dersler
      const { data: subs } = await supabase
        .from('subjects')
        .select('id,name')
        .order('name', { ascending: true });
      setSubjects((subs ?? []) as Subject[]);
    })();
  }, []);

  // seçili dersin konuları
  useEffect(() => {
    if (!subjectId || !isAdmin) {
      setTopics([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('id,name,subject_id,created_at')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true }); // ekleme sırası
      if (error) setMsg(error.message);
      setTopics((data ?? []) as Topic[]);
    })();
  }, [subjectId, isAdmin]);

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );

  async function addTopic() {
    if (!isAdmin) return;
    const name = newTopicName.trim();
    if (!subjectId) return alert('Önce ders seçin.');
    if (!name) return;

    setBusyId('new');
    setMsg(undefined);
    try {
      const { data, error } = await supabase
        .from('topics')
        .insert({ subject_id: subjectId, name })
        .select('id,name,subject_id,created_at')
        .single();
      if (error) throw error;
      setTopics((prev) => [...prev, data as Topic]); // created_at sırasına göre zaten en alta eklenecek
      setNewTopicName('');
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function renameTopic(t: Topic) {
    const val = prompt('Yeni konu adı:', t.name);
    if (!val || val.trim() === '' || val.trim() === t.name) return;

    setBusyId(t.id);
    setMsg(undefined);
    try {
      const { data, error } = await supabase
        .from('topics')
        .update({ name: val.trim() })
        .eq('id', t.id)
        .select('id,name,subject_id,created_at')
        .single();
      if (error) throw error;
      setTopics((prev) => prev.map((x) => (x.id === t.id ? (data as Topic) : x)));
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTopic(t: Topic) {
    if (!confirm(`"${t.name}" konusunu silmek istiyor musunuz?\n(Bu konuyu kullanan kayıtların topic_id değerleri NULL olur)`)) {
      return;
    }
    setBusyId(t.id);
    setMsg(undefined);
    try {
      const { error } = await supabase.from('topics').delete().eq('id', t.id);
      if (error) throw error;
      setTopics((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!userId) {
    return (
      <main className="p-6">
        <p>Bu sayfa için giriş yapmalısınız. <Link href="/login" className="text-indigo-600 hover:underline">Giriş</Link></p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Yetkiniz yok</h1>
        <p className="text-gray-600">Bu sayfa sadece yöneticiler (admin) içindir.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Konu Yönetimi</h1>
        <Link href="/" className="rounded-lg border px-3 py-2 hover:bg-gray-50">Panele dön</Link>
      </div>

      {msg && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm">{msg}</div>}

      {/* Ders seçimi */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
         <label className="text-sm font-medium mr-3">Lütfen Ders Seçimi Yapınız</label>
         <select
            className="rounded border p-2 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
        >
            <option value="">Ders seçiniz…</option>
            {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ))}
         </select>
        </div>
      </section>

      {/* Konu listesi + ekleme */}
      {subjectId && (
        <section className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {currentSubject?.name} • Konular (eklenme sırası)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Yeni konu adı"
                className="rounded border p-2 text-sm"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
              />
              <button
                onClick={addTopic}
                disabled={!newTopicName.trim() || busyId === 'new'}
                className="rounded bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {busyId === 'new' ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </div>
          </div>

          <ul className="divide-y">
            {topics.map((t, i) => (
              <li key={t.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 w-6 text-right">{i + 1}.</span>
                  <span className="font-medium">{t.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => renameTopic(t)}
                    disabled={busyId === t.id}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                  >
                    Yeniden Adlandır
                  </button>
                  <button
                    onClick={() => deleteTopic(t)}
                    disabled={busyId === t.id}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}

            {topics.length === 0 && (
              <li className="py-8 text-center text-gray-500 text-sm">Bu derste henüz konu yok.</li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
