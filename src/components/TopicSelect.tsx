'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Topic = { id:string; name:string; subject_id:string; is_active:boolean };

export default function TopicSelect({
  subjectId, value, onChange
}:{ subjectId:string|''; value:string|''; onChange:(id:string)=>void }) {
  const [items, setItems] = useState<Topic[]>([]);

  useEffect(() => {
    if (!subjectId) { setItems([]); onChange(''); return; }
    supabase.from('topics')
      .select('id,name,subject_id,is_active')
      .eq('subject_id', subjectId)
      .order('name')
      .then(({ data }) => setItems(data ?? []));
  }, [subjectId, onChange]);

  return (
    <select className="w-full rounded-lg border p-2"
            value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Konu seç (opsiyonel)</option>
      {items.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
