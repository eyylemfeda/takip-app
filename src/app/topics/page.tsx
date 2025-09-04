'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import Link from 'next/link';

type Subject = { id:string; name:string };
type Topic = { id:string; name:string; subject_id:string; is_active:boolean; created_at:string };

export default function TopicsPage() {
  const [uid, setUid] = useState<string>();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [name, setName] = useState('');
  const [list, setList] = useState<Topic[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id));
    supabase.from('subjects').select('id,name').order('name')
      .then(({ data }) => setSubjects((data ?? []) as Subject[]));
  }, []);

  async function load() {
    if (!subjectId) { setList([]); return; }
    const { data } = await supabase
      .from('topics')
      .select('id,name,subject_id,is_active,created_at')
      .eq('subject_id', subjectId)
      .order('name');
    setList((data ?? []) as Topic[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [subjectId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !name.trim()) return;
    await supabase.from('topics').insert({ subject_id: subjectId, name: name.trim(), is_active: true });
    setName('');
    load();
  }

  async function toggle(id:string, is_active:boolean) {
    await supabase.from('topics').update({ is_active }).eq('id', id);
    load();
  }

  if (!uid) return (
    <main className="p-6 space-y-2">
      <p>Bu sayfa için giriş gerekiyor.</p>
      <Link className="text-blue-600 hover:underline" href="/login">Giriş yap</Link>
    </main>
  );

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Konular</h1>

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <select className="w-full rounded-lg border p-2" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>
          <option value="">Ders seç</option>
          {subjects.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <form onSubmit={add} className="flex gap-2">
          <input className="flex-1 rounded-lg border p-2" placeholder="Yeni konu adı"
                 value={name} onChange={e=>setName(e.target.value)} />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Ekle</button>
        </form>
      </div>

      {subjectId && (
        <ul className="grid gap-2">
          {list.map(t=>(
            <li key={t.id} className="rounded-lg border bg-white p-3 shadow-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                {!t.is_active && <div className="text-xs text-gray-500">pasif</div>}
              </div>
              <div className="flex gap-2">
                {t.is_active
                  ? <button onClick={()=>toggle(t.id,false)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Pasifleştir</button>
                  : <button onClick={()=>toggle(t.id,true)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Aktifleştir</button>}
              </div>
            </li>
          ))}
          {list.length===0 && <p className="text-sm text-gray-500">Bu derste konu yok.</p>}
        </ul>
      )}
    </main>
  );
}
