'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Rec } from '@/types'; // id, created_at, subjects(name), question_count, duration_min, note

type Subject = { id: string; name: string };

export default function RecordsList() {
  const [uid, setUid] = useState<string>();
  const [rows, setRows] = useState<Rec[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<string>(''); // filtre
  const [dateFrom, setDateFrom] = useState<string>(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>('');     // yyyy-mm-dd
  const [msg, setMsg] = useState<string>();
  const SHORT_LABEL: Record<string, string> = {
  'Din Kültürü ve Ahlak Bilgisi': 'Din Kül. ve Ahl. Bil.',
  'T.C. İnkılap Tarihi': 'İnkılap Tarihi', // istersen burada da kısalt
};




  // oturum + ders listesi
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id));
    supabase
      .from('subjects')
      .select('id,name')
      .order('name')
      .returns<Subject[]>()
      .then(({ data }) => setSubjects(data ?? []));
  }, []);

  const selector =
    'id,created_at,subject_id,subjects(name),topics(name),sources(name),question_count,duration_min,note';

  async function load() {
    if (!uid) return;
    setMsg(undefined);
    let q = supabase
      .from('records')
      .select(selector)
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (subject) q = q.eq('subject_id', subject);
    if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1); // dahil etmek için ertesi gün 00:00
      q = q.lt('created_at', to.toISOString());
    }

    const { data, error } = await q.returns<Rec[]>();
    if (error) setMsg('Hata: ' + error.message);
    else setRows(data ?? []);
  }

  // ilk yükleme
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const summary = useMemo(() => {
    const totalQ = rows.reduce((a, r) => a + (r.question_count ?? 0), 0);
    const totalM = rows.reduce((a, r) => a + (r.duration_min ?? 0), 0);
    return { totalQ, totalM };
  }, [rows]);

  // --- Kayıt silme ---
  async function handleDelete(id: string) {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
    setMsg(undefined);
    const { error } = await supabase.from('records').delete().eq('id', id);
    if (error) {
      setMsg('Silme hatası: ' + error.message);
      return;
    }
    // Optimistic refresh
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (!uid) {
    return (
      <main className="p-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">
          Giriş yap
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Kayıtlar</h1>

      {/* Filtreler */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            className="rounded-lg border p-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">Ders (hepsi)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            className="rounded-lg border p-2"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            className="rounded-lg border p-2"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <div className="flex gap-2">
            <button onClick={load} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
              Filtrele
            </button>
            <Link href="/records/new" className="rounded-lg border px-3 py-2 hover:bg-gray-50">
              Yeni Kayıt
            </Link>
          </div>
        </div>
        {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      </div>

      {/* Özet + Liste */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-gray-600">
          Toplam: <b>{rows.length}</b> kayıt • <b>{summary.totalQ} Soru</b> • Süre:{' '}
          <b>{summary.totalM} dk</b>
        </div>

        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 shadow-sm">
              <div className="grid grid-cols-3 items-center">
                {/* Sol */}
                <span className="font-medium justify-self-start">
                {SHORT_LABEL[r.subjects?.name ?? ''] ?? r.subjects?.name}
                {r.question_count ? `: ${r.question_count}` : ''} Soru
                {r.question_count && r.duration_min ? ' • ' : ''}
                {r.duration_min ? `Süre: ${r.duration_min} dk` : ''}
                </span>

                {/* Orta */}
                <span className="text-sm text-gray-800 justify-self-center">
                {new Date(r.created_at).toLocaleString()}
                </span>

                {/* Sağ */}
                <div className="flex gap-2 justify-self-end">
                <Link
                href={`/records/new?id=${r.id}`}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
                >
                Güncelle
                </Link>
                <button
                onClick={() => handleDelete(r.id)}
                className="rounded-lg border px-3 py-1 text-sm text-red-600 border-red-200 hover:bg-red-50"
                >
                Sil
               </button>
              </div>
            </div>

              
              {/* BU BÖLÜMÜ YORUM YAPTIM, SORU SAYISINI DERS ADININ YANINA EKLEDİM
              <div className="mt-1 text-sm text-gray-700">
                {r.question_count ? `Soru: ${r.question_count}` : ''}
                {r.question_count && r.duration_min ? ' • ' : ''}
                {r.duration_min ? `Süre: ${r.duration_min} dk` : ''}
              </div>
              */}
              {r.note && <div className="mt-1 text-sm text-gray-600">{r.note}</div>}

              {/* Aksiyonlar: sağ altta – Güncelle (sol) & Sil (sağ) */}
            </li>
          ))}

          {rows.length === 0 && <p className="text-sm text-gray-500">Kayıt bulunamadı.</p>}
        </ul>
      </div>
    </main>
  );
}
