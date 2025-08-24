'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Source = { id:string; name:string; is_active:boolean };

export default function SourceSelect({
  value, onChange
}:{ value:string|''; onChange:(id:string)=>void }) {
  const [items, setItems] = useState<Source[]>([]);
  useEffect(() => {
    supabase.from('sources').select('id,name,is_active').order('name')
      .then(({ data }) => setItems(data ?? []));
  }, []);
  return (
    <select className="w-full rounded-lg border p-2"
            value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Kaynak seç (opsiyonel)</option>
      {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
