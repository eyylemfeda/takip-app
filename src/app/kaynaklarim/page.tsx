'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Subject = { id: string; name: string };
type Source  = { id: string; name: string; subject_id: string; user_id: string };

export default function MySourcesPage() {
  const [uid, setUid] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows]         = useState<Source[]>([]);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<string>();

  // filtre & arama
  const [subjectFilter, setSubjectFilter] = useState<string>(''); // boş = hepsi
  const [q, setQ] = useState('');

  // yeni kaynak ekleme
  const [newName, setNewName] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');

  // düzenleme modu
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUid(id);

      const { data: s1 } = await supabase
        .from('subjects')
        .select('id,name')
        .order('name');
      setSubjects((s1 ?? []) as Subject[]);
    })();
  }, []);

  async function load() {
    if (!uid) return;
    setLoading(true);
    setMsg(undefined);
    try {
      let q1 = supabase
        .from('sources')
        .select('id,name,subject_id,user_id')
        .eq('user_id', uid)
        .order('name');

      if (subjectFilter) q1 = q1.eq('subject_id', subjectFilter);

      const { data, error } = await q1.returns<Source[]>();
      if (error) throw error;

      setRows(data ?? []);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, subjectFilter]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(term));
  }, [rows, q]);

  async function addSource() {
    if (!uid) return;
    const name = newName.replace(/\s+/g, ' ').trim();
    if (!name) return alert('İsim girin.');
    if (!newSubjectId) return alert('Ders seçin.');

    const { data, error } = await supabase
      .from('sources')
      .insert({ user_id: uid, subject_id: newSubjectId, name })
      .select('id,name,subject_id,user_id')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        alert('Bu derste aynı isimde bir kaynak zaten var.');
      } else {
        alert((error as any).message);
      }
      return;
    }

    setRows(prev => [...prev, data as Source].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName('');
  }

  function startEdit(s: Source) {
    setEditId(s.id);
    setEditName(s.name);
    setEditSubjectId(s.subject_id);
  }
  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setEditSubjectId('');
  }
  async function saveEdit() {
    if (!editId) return;
    const name = editName.replace(/\s+/g, ' ').trim();
    if (!name) return alert('İsim boş olamaz.');
    if (!editSubjectId) return alert('Ders seçin.');

    const { data, error } = await supabase
      .from('sources')
      .update({ name, subject_id: editSubjectId })
      .eq('id', editId)
      .select('id,name,subject_id,user_id')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        alert('Bu derste aynı isimde bir kaynak zaten var.');
      } else {
        alert((error as any).message);
      }
      return;
    }

    setRows(prev => {
      const next = prev.map(x => (x.id === editId ? (data as Source) : x));
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
    cancelEdit();
  }
  async function removeSource(id: string) {
    if (!confirm('Bu kaynağı silmek istiyor musunuz?')) return;
    const { error } = await supabase.from('sources').delete().eq('id', id);
    if (error) {
      alert((error as any).message);
      return;
    }
    setRows(prev => prev.filter(x => x.id !== id));
  }

  return (
    <main className="mx-auto max-w-none sm:max-w-3xl px-0 sm:px-4 md:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
      <h1 className="text-2xl font-bold px-1 sm:px-0">Kaynaklarım</h1>

      {/* Ekle */}
      <section className="mx-1 sm:mx-0 rounded-lg sm:rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded border p-2"
            placeholder="Yeni kaynak adı…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={!uid}
          />
          <select
            className="rounded border p-2"
            value={newSubjectId}
            onChange={(e) => setNewSubjectId(e.target.value)}
          >
            <option value="">Ders seçin…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={addSource}
            disabled={!uid || !newSubjectId || !newName.trim()}
            className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Not: Aynı isim, <b>aynı kullanıcı + aynı derste</b> yalnızca bir kez olabilir.
        </p>
      </section>

      {/* Filtre & Arama */}
      <section className="mx-1 sm:mx-0 rounded-lg sm:rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="rounded border p-2"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">Tüm dersler</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            className="rounded border p-2"
            placeholder="Ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={load}
            className="rounded border px-4 py-2 hover:bg-gray-50"
          >
            Yenile
          </button>
        </div>
      </section>

      {/* Liste */}
      <section className="mx-1 sm:mx-0 rounded-lg sm:rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
        {loading ? (
          <p className="text-sm text-gray-500">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Kayıt yok.</p>
        ) : (
          <ul className="grid gap-2">
            {filtered.map(s => {
              const subjectName = subjects.find(x => x.id === s.subject_id)?.name ?? 'Ders';

              return (
                <li key={s.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  {/* Sol: isim + ders */}
                  <div className="min-w-0">
                    {editId === s.id ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="rounded border p-2 text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <select
                          className="rounded border p-2 text-sm"
                          value={editSubjectId}
                          onChange={(e) => setEditSubjectId(e.target.value)}
                        >
                          {subjects.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-600">{subjectName}</div>
                      </>
                    )}
                  </div>

                  {/* Sağ: aksiyonlar */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {editId === s.id ? (
                      <>
                        <button onClick={saveEdit} className="rounded bg-indigo-600 px-3 py-1 text-white text-sm hover:bg-indigo-700">
                          Kaydet
                        </button>
                        <button onClick={cancelEdit} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                          İptal
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(s)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                          Düzenle
                        </button>
                        <button onClick={() => removeSource(s.id)} className="rounded bg-red-600 px-3 py-1 text-white text-sm hover:bg-red-700">
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
