'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Subject, Source } from '@/types';
import type { Topic, Profile } from '@/types';

const supabase = createClient();

export default function AdminTopicsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopicName, setNewTopicName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>();

  // Admin kontrolü + dersleri yükle
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        const uid = sessionRes.session?.user?.id;
        if (!uid) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // admin mi?
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', uid)
          .maybeSingle()
          .returns<Pick<Profile, 'is_admin'> | null>();

        if (profErr) throw profErr;
        setIsAdmin(!!prof?.is_admin);

        // dersler
        const { data: subs, error: subErr } = await supabase
          .from('subjects')
          .select('id,name,is_active,created_at')
          .order('created_at', { ascending: true }) // eklenme sırası
          .returns<Subject[]>();

        if (subErr) throw subErr;
        setSubjects(subs ?? []);

        // otomatik ilk dersi seç
        if ((subs?.length ?? 0) > 0) {
          setSelectedSubjectId(subs![0].id);
        }
      } catch (e: any) {
        setMsg('Hata: ' + (e.message ?? e.toString()));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // seçilen derse ait konular
  useEffect(() => {
    if (!selectedSubjectId) {
      setTopics([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('id,subject_id,name,created_at')
        .eq('subject_id', selectedSubjectId)
        .order('created_at', { ascending: true }) // eklenme sırası
        .returns<Topic[]>();

      if (error) {
        setMsg('Konu listesi alınamadı: ' + error.message);
        setTopics([]);
      } else {
        setTopics(data ?? []);
      }
    })();
  }, [selectedSubjectId]);

  const selectedSubject = useMemo(
    () => subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  async function addTopic() {
    setMsg(undefined);
    if (!selectedSubjectId || !newTopicName.trim()) return;

    setBusyId('add');
    try {
      const { error } = await supabase
        .from('topics')
        .insert({ subject_id: selectedSubjectId, name: newTopicName.trim() });
      if (error) throw error;

      setNewTopicName('');
      // yeniden yükle
      const { data } = await supabase
        .from('topics')
        .select('id,subject_id,name,created_at')
        .eq('subject_id', selectedSubjectId)
        .order('created_at', { ascending: true })
        .returns<Topic[]>();
      setTopics(data ?? []);
    } catch (e: any) {
      setMsg('Konu eklenemedi: ' + (e.message ?? e.toString()));
    } finally {
      setBusyId(null);
    }
  }

  async function renameTopic(t: Topic) {
    const name = window.prompt('Yeni konu adı', t.name);
    if (!name || name.trim() === t.name) return;

    setBusyId(t.id);
    setMsg(undefined);
    try {
      const { error } = await supabase
        .from('topics')
        .update({ name: name.trim() })
        .eq('id', t.id);
      if (error) throw error;

      // local state’i güncelle
      setTopics(prev =>
        prev.map(x => (x.id === t.id ? { ...x, name: name.trim() } : x))
      );
    } catch (e: any) {
      setMsg('Yeniden adlandırma başarısız: ' + (e.message ?? e.toString()));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTopic(t: Topic) {
    if (!confirm(`"${t.name}" konusunu silmek istiyor musun?`)) return;

    setBusyId(t.id);
    setMsg(undefined);
    try {
      const { error } = await supabase.from('topics').delete().eq('id', t.id);
      if (error) throw error;
      setTopics(prev => prev.filter(x => x.id !== t.id));
    } catch (e: any) {
      setMsg('Silinemedi: ' + (e.message ?? e.toString()));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="p-6">Yükleniyor…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Konu Yönetimi</h1>
        <p className="text-gray-600">Bu sayfayı sadece yöneticiler görebilir.</p>
      </div>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Konu Yönetimi</h1>
        <a
          href="/"
          className="rounded border px-3 py-2 hover:bg-gray-50"
          title="Panele dön"
        >
          Panele dön
        </a>
      </div>

      {msg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
          {msg}
        </div>
      )}

      {/* Ders seçimi */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium mb-1">Ders</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Konular */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Yeni konu adı"
            className="flex-1 rounded border px-3 py-2"
          />
          <button
            onClick={addTopic}
            disabled={busyId === 'add' || !newTopicName.trim()}
            className="rounded bg-blue-600 text-white px-3 py-2 disabled:opacity-50"
          >
            {busyId === 'add' ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {selectedSubject
            ? `${selectedSubject.name} • Konular (eklenme sırası)`
            : 'Konu listesi'}
        </div>

        <ul className="divide-y rounded border">
          {topics.map((t, i) => (
            <li key={t.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-gray-500">{i + 1}.</span>
                <span className="font-medium">{t.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => renameTopic(t)}
                  disabled={busyId === t.id}
                  className="rounded border px-3 py-1 hover:bg-gray-50"
                >
                  Yeniden Adlandır
                </button>
                <button
                  onClick={() => deleteTopic(t)}
                  disabled={busyId === t.id}
                  className="rounded bg-red-600 text-white px-3 py-1 hover:bg-red-700 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
            </li>
          ))}

          {topics.length === 0 && (
            <li className="p-3 text-sm text-gray-500">Henüz konu yok.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
