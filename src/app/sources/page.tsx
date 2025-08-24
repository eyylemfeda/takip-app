'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Source = { id:string; name:string; is_active:boolean; created_at:string };

export default function SourcesPage() {
  const [uid, setUid] = useState<string>();
  const [name, setName] = useState('');
  const [list, setList] = useState<Source[]>([]);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id));
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from('sources')
      .select('id,name,is_active,created_at')
      .order('name');
    if (!error) setList((data ?? []) as Source[]);
  }

  useEffect(() => { if (uid) load(); }, [uid]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from('sources').insert({ name: name.trim(), is_active: true });
    if (error) setMsg('Hata: ' + error.message); else { setName(''); load(); }
  }

  async function toggle(id:string, is_active:boolean) {
    await supabase.from('sources').update({ is_active }).eq('id', id);
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
      <h1 className="text-2xl font-bold">Kaynaklar</h1>

      <form onSubmit={add} className="flex gap-2 rounded-xl border bg-white p-4 shadow-sm">
        <input className="flex-1 rounded-lg border p-2" placeholder="Yeni kaynak adı"
               value={name} onChange={e=>setName(e.target.value)} />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Ekle</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <ul className="grid gap-2">
        {list.map(s=>(
          <li key={s.id} className="rounded-lg border bg-white p-3 shadow-sm flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              {!s.is_active && <div className="text-xs text-gray-500">pasif</div>}
            </div>
            <div className="flex gap-2">
              {s.is_active
                ? <button onClick={()=>toggle(s.id,false)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Pasifleştir</button>
                : <button onClick={()=>toggle(s.id,true)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Aktifleştir</button>}
            </div>
          </li>
        ))}
        {list.length===0 && <p className="text-sm text-gray-500">Henüz kaynak eklenmedi.</p>}
      </ul>
    </main>
  );
}
