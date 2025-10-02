'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';

/* ========= Tipler ========= */
type RecordRow = {
  id: string;
  activity_date: string | null;
  off_calendar: boolean | null;
  subject: { id: string; name: string } | null;
  topic: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
  question_count: number | null;
  duration_min: number | null;
  note: string | null;
};

/* ========= Yardımcılar ========= */
function todayLocalISODate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
function formatDMYFromISO(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function RecordsPage() {
  const { uid, loading } = useRequireActiveUser();

  const [rows, setRows] = useState<RecordRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string>();

  // uid hazır olduğunda listeyi çek
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return; // hook login'e yönlendirmiştir
      setBusy(true);
      setMsg(undefined);

      const { data: recs, error } = await supabase
        .from('records')
        .select(`
          id,
          activity_date,
          off_calendar,
          question_count,
          duration_min,
          note,
          subject:subjects(id,name),
          topic:topics(id,name),
          source:sources(id,name)
        `)
        .eq('user_id', uid)
        .order('activity_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        setRows([]);
      } else {
        setRows((recs ?? []) as unknown as RecordRow[]);
      }
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // İlk anda (hook kontrol yaparken)
  if (loading) {
    return (
      <main className="px-2 py-5">
        <p className="text-sm text-gray-600">Yükleniyor…</p>
      </main>
    );
  }

  // uid yoksa render etmiyoruz (hook zaten /login'e attı)
  if (!uid) return null;

  return (
    <main className="mx-auto max-w-none sm:max-w-3xl px-2 sm:px-4 md:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
      {/* Üst bar */}
      <div className="mb-3 sm:mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Çalışma Kayıtlarım</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/records/new"
            className="inline-flex items-center justify-center
                       h-7 w-24
                       rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700
                       md:h-auto md:w-auto md:px-4 md:py-2 md:text-sm"
          >
            Yeni Kayıt
          </Link>
        </div>
      </div>

      {/* Hata/mesaj */}
      {msg && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      {/* Liste */}
      <div className="rounded-lg sm:rounded-xl border bg-white shadow-sm">
        {busy ? (
          <div className="p-4 text-sm text-gray-600">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            Kayıt bulunamadı.{' '}
            <Link className="text-blue-600 underline" href="/records/new">
              Yeni kayıt ekle
            </Link>.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {r.subject?.name || 'Ders'} {r.topic?.name ? `• ${r.topic.name}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.off_calendar
                        ? 'Takvim dışı'
                        : formatDMYFromISO(r.activity_date) ||
                          formatDMYFromISO(todayLocalISODate())}
                      {r.source?.name ? ` • ${r.source.name}` : ''}
                    </div>
                    {r.note && (
                      <div className="mt-1 text-sm text-gray-700">
                        {r.note}
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-700">
                    {r.question_count != null && (
                      <span className="inline-block rounded border px-2 py-1 mr-1">
                        Soru: {r.question_count}
                      </span>
                    )}
                    {r.duration_min != null && (
                      <span className="inline-block rounded border px-2 py-1">
                        Süre: {r.duration_min} dk
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
