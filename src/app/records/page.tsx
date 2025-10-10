'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
                <div className="flex flex-col text-sm text-gray-800 space-y-1">

                  {/* 1️⃣ Tarih, Ders ve Soru Sayısı */}
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {(r.off_calendar
                        ? 'Takvim dışı'
                        : formatDMYFromISO(r.activity_date) ||
                          formatDMYFromISO(todayLocalISODate()))}{' '}
                      • {r.subject?.name || 'Ders'}
                    </div>

                    {r.question_count != null && (
                      <span className="inline-block rounded border border-gray-300 px-2 py-0.5 text-sm">
                        {r.question_count} Soru
                      </span>
                    )}
                  </div>

                  {/* 2️⃣ Kaynak */}
                  {r.source?.name && (
                    <div className="font-semibold text-gray-700">{r.source.name}</div>
                  )}

                  {/* 3️⃣ Konu */}
                  {r.topic?.name && (
                    <div className="font-semibold">{r.topic.name}</div>
                  )}

                  {/* 4️⃣ Butonlar */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {/* 🧡 Güncelle */}
                    <button
                      onClick={() => router.push(`/records/new?id=${r.id}`)}
                      className="rounded border border-orange-300 bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100"
                    >
                      Güncelle
                    </button>

                    {/* 🔴 Sil */}
                    <button
                      onClick={async () => {
                        if (confirm("Bu kaydı silmek istediğine emin misin?")) {
                          const { error } = await supabase
                            .from("records")
                            .delete()
                            .eq("id", r.id);
                          if (!error) {
                            setRows((prev) => prev.filter((item) => item.id !== r.id));
                          } else {
                            alert("Silme işlemi başarısız: " + error.message);
                          }
                        }
                      }}
                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      Sil
                    </button>
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
