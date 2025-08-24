'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Subject = { id:string; name:string; is_active:boolean };

export default function SubjectSelect({
  value, onChange
}:{ value:string|''; onChange:(id:string)=>void }) {
  const [items, setItems] = useState<Subject[]>([]);
  useEffect(() => {
    supabase.from('subjects').select('id,name,is_active').order('name')
      .then(({ data }) => setItems(data ?? []));
  }, []);
  return (
    <select className="w-full rounded-lg border p-2"
            value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Ders seç</option>
      {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
