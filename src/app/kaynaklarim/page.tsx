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
  const subjectOrder = [
  'Fen Bilimleri',
  'Matematik',
  'Türkçe',
  'Paragraf',
  'T.C. İnkılap Tarihi',
  'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce',
];


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

      {/* Ekle / Düzenle Formu */}
    <section className="mx-1 sm:mx-0 rounded-lg sm:rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold mb-2">
        {editId ? 'Kaynağı Güncelle' : 'Yeni Kaynak Ekle'}
      </h2>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          className="rounded border p-2"
          placeholder="Kaynak adı…"
          value={editId ? editName : newName}
          onChange={(e) => (editId ? setEditName(e.target.value) : setNewName(e.target.value))}
          disabled={!uid}
        />

        <select
          className="rounded border p-2"
          value={editId ? editSubjectId : newSubjectId}
          onChange={(e) =>
            editId ? setEditSubjectId(e.target.value) : setNewSubjectId(e.target.value)
          }
        >
          <option value="">Ders seçin…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Kaydet veya Güncelle */}
        <button
          onClick={editId ? saveEdit : addSource}
          disabled={
            !uid ||
            !(editId ? editSubjectId && editName.trim() : newSubjectId && newName.trim())
          }
          className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {editId ? 'Güncelle' : 'Ekle'}
        </button>

        {/* Vazgeç butonu (yalnızca düzenleme modunda) */}
        {editId && (
          <button
            onClick={cancelEdit}
            className="rounded border px-4 py-2 text-gray-600 hover:bg-gray-50"
          >
            Vazgeç
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Not: Düzenlemek istediğiniz kaynak için "Düzenle" butonuna basıp, güncelleme yapmak için bu bölüme dönünüz.
      </p>
    </section>


      {/* Liste */}
      <section className="mx-1 sm:mx-0 rounded-lg sm:rounded-xl bg-white p-3 sm:p-4 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold mb-2">Kaynak Listesi</h2>

        {subjectOrder.map((subjectName) => {
          const subject = subjects.find((s) => s.name === subjectName);
          const subjectSources = filtered
            .filter((src) => src.subject_id === subject?.id)
            .sort((a, b) => a.name.localeCompare(b.name));

          return (
            <div key={subjectName} className="border rounded-xl p-3 sm:p-4">
              <h3 className="text-lg font-bold mb-2 text-gray-800">{subjectName}</h3>

              {subjectSources.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Henüz kaynak kaydı oluşturulmadı.
                </p>
              ) : (
                <ul className="space-y-2">
                  {subjectSources.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between border-b border-gray-200 pb-1 last:border-none"
                    >
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded border px-3 py-1 text-xs sm:text-sm hover:bg-gray-50"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => removeSource(s.id)}
                          className="rounded bg-red-600 px-3 py-1 text-xs sm:text-sm text-white hover:bg-red-700"
                        >
                          Sil
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
