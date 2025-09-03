'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Rec } from '@/types'; // id, created_at, activity_date, subjects(name), question_count, duration_min, note

type Subject = { id: string; name: string };

/* ======================= 01:00–01:00 GÜN TANIMI ======================= */
const DAY_START_HOUR = 1; // 01:00

// YYYY-MM-DD
function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Verilen yerel tarihin hour:00 anını ISO (UTC) stringe çevir
function localAtHourISO(d: Date, hour: number) {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString();
}

// YYYY-MM-DD için [startISO, nextStartISO) penceresi (01:00–ertesi 01:00)
function logicalWindowISO(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const startISO = localAtHourISO(day, DAY_START_HOUR);
  const nextDay = new Date(y, m - 1, d + 1);
  const nextStartISO = localAtHourISO(nextDay, DAY_START_HOUR);
  return { startISO, nextStartISO };
}
/* ===================================================================== */

export default function RecordsList() {
  const [uid, setUid] = useState<string>();
  const [rows, setRows] = useState<Rec[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<string>(''); // filtre
  const [dateFrom, setDateFrom] = useState<string>(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>('');     // yyyy-mm-dd
  const [msg, setMsg] = useState<string>();
  const [showFilters, setShowFilters] = useState(false); // 🔽 mobilde açılır/kapanır

  const SHORT_LABEL: Record<string, string> = {
    'Din Kültürü ve Ahlak Bilgisi': 'Din Kül. ve Ahl. Bil.',
    'T.C. İnkılap Tarihi': 'İnkılap Tarihi',
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
    'id,created_at,activity_date,subject_id,subjects(name),topics(name),sources(name),question_count,duration_min,note';

  async function load() {
    if (!uid) return;
    setMsg(undefined);

    let q = supabase
      .from('records')
      .select(selector)
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    // Ders filtresi
    if (subject) q = q.eq('subject_id', subject);

    // ------- TARİH FİLTRELERİ -------
    // Hiç tarih seçilmediyse: TÜM KAYITLAR (filtre uygulanmaz)
    // Tarih seçildiyse: activity_date üzerinden, activity_date NULL ise created_at penceresi (01:00–01:00)
    const hasFrom = !!dateFrom?.trim();
    const hasTo = !!dateTo?.trim();

    if (hasFrom || hasTo) {
      const fromStr = hasFrom ? dateFrom.trim() : undefined;
      const toStr = hasTo ? dateTo.trim() : undefined;

      // created_at için pencere:
      // - from yoksa alt sınır koyma
      // - to yoksa üst sınır koyma
      let createdFilter = '';
      if (fromStr && toStr) {
        // [from 01:00, (to+1) 01:00)
        const { startISO: fromISO } = logicalWindowISO(fromStr);
        const { nextStartISO: toEndISO } = logicalWindowISO(toStr);
        createdFilter = `created_at.gte.${fromISO},created_at.lt.${toEndISO}`;
      } else if (fromStr && !toStr) {
        // [from 01:00, +∞)
        const { startISO: fromISO } = logicalWindowISO(fromStr);
        createdFilter = `created_at.gte.${fromISO}`;
      } else if (!fromStr && toStr) {
        // (-∞, (to+1) 01:00)
        const { nextStartISO: toEndISO } = logicalWindowISO(toStr);
        createdFilter = `created_at.lt.${toEndISO}`;
      }

      // activity_date için aralık: from/to varsa kullan
      let activityFilter = '';
      if (fromStr && toStr) {
        activityFilter = `activity_date.gte.${fromStr},activity_date.lte.${toStr}`;
      } else if (fromStr && !toStr) {
        activityFilter = `activity_date.gte.${fromStr}`;
      } else if (!fromStr && toStr) {
        activityFilter = `activity_date.lte.${toStr}`;
      }

      // Supabase .or ifadesi: iki grubu OR'la
      if (activityFilter && createdFilter) {
        q = q.or(`and(${activityFilter}),and(activity_date.is.null,${createdFilter})`);
      } else if (activityFilter && !createdFilter) {
        q = q.or(`and(${activityFilter})`);
      } else if (!activityFilter && createdFilter) {
        q = q.or(`and(activity_date.is.null,${createdFilter})`);
      }
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
      <main className="px-1 py-4 sm:px-4 md:px-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">
          Giriş yap
        </Link>
      </main>
    );
  }

  return (
    <main className="px-1 py-4 sm:px-4 md:px-6 space-y-3 sm:space-y-4 w-full">
      <h1 className="text-2xl font-bold">Kayıtlar</h1>

      {/* Filtreler */}
      <div className="w-full rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        {/* Başlık + toggle sadece mobilde */}
        <div className="flex items-center justify-between md:hidden">
          <h2 className="font-semibold">Filtreler</h2>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="text-sm text-blue-600 flex items-center gap-1"
            aria-expanded={showFilters}
            aria-controls="filters-panel"
          >
            {showFilters ? 'Kapat ▲' : 'Aç ▼'}
          </button>
        </div>

        {/* Filtre kutuları: mobilde açılır/kapanır, masaüstünde hep açık */}
        <div id="filters-panel" className={`${showFilters ? 'mt-3 block' : 'hidden'} md:block`}>
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
          <p className="mt-2 text-xs text-gray-500">
            Tarih seçmezsen tüm kayıtlar gösterilir. Tarih seçildiğinde aralık, <b>01:00–01:00</b> penceresine göre hesaplanır.
          </p>
          {msg && <p className="mt-1 text-sm text-red-600">{msg}</p>}
        </div>
      </div>

      {/* Özet + Liste */}
      <div className="w-full rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="mb-3 text-sm text-gray-600">
          Toplam: <b>{rows.length}</b> kayıt • <b>{summary.totalQ} Soru</b> • Süre:{' '}
          <b>{summary.totalM} dk</b>
        </div>

        <ul className="grid gap-2">
          {rows.map((r) => {
            const dateStr = r.activity_date
              ? new Date(r.activity_date + 'T00:00:00').toLocaleDateString()
              : new Date(r.created_at).toLocaleString();

            const leftText = `${
              (SHORT_LABEL[r.subjects?.name ?? ''] ?? r.subjects?.name) || 'Ders'
            }${r.question_count ? `: ${r.question_count}` : ''} Soru${
              r.question_count && r.duration_min ? ' • ' : ''
            }${r.duration_min ? `Süre: ${r.duration_min} dk` : ''}`;

            return (
              <li key={r.id} className="w-full rounded-lg border p-2 sm:p-3 shadow-sm">
                {/* Mobil: flex; Masaüstü: grid 3 kolon */}
                <div className="flex items-start justify-between md:grid md:grid-cols-3 md:items-center">
                  {/* Sol blok (mobilde: başlık satırı + alt satırda tarih) */}
                  <div className="min-w-0 md:min-w-[auto]">
                    <div className="font-medium text-sm md:text-base">
                      {leftText}
                    </div>
                    {/* Tarih: sadece mobilde göster */}
                    <div className="mt-0.5 text-xs text-gray-800 md:hidden">
                      {dateStr}
                    </div>
                  </div>

                  {/* Orta kolon: sadece masaüstünde tarih */}
                  <div className="hidden md:block text-sm text-gray-800 justify-self-center">
                    {dateStr}
                  </div>

                  {/* Sağ: butonlar — mobilde kompakt, masaüstünde normal */}
                  <div className="flex items-center gap-2 self-center md:justify-self-end">
                    <Link
                      href={`/records/new?id=${r.id}`}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50 md:px-3 md:py-1 md:text-sm"
                    >
                      Güncelle
                    </Link>

                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded-lg border px-2 py-1 text-xs bg-red-600 text-white border-red-600 hover:bg-red-700 md:px-3 md:py-1 md:text-sm"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                {/* Not: varsa, mobil/masaüstü ikisinde de altta */}
                {r.note && <div className="mt-1 text-sm text-gray-600">{r.note}</div>}
              </li>
            );
          })}

          {rows.length === 0 && <p className="text-sm text-gray-500">Kayıt bulunamadı.</p>}
        </ul>
      </div>
    </main>
  );
}
