'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Rec } from '@/types';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList
} from 'recharts';
// en üst importlara ekle
import { QUOTES } from '@/data/quotes';

const RAD = Math.PI / 180;
function renderPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, value,
}: any) {
  // Dilimin tam ortasına yakın bir yarıçap
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"                 // beyaz, sabit ve net görünsün
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={12}
      fontWeight={600}
    >
      {value}
    </text>
  );
}


// bugüne göre deterministik seçim (her gün farklı görünsün)
function getTodayQuote() {
  const today = new Date();
  // İstersen gün + ay + yıl kullanarak daha geniş döngü sağlayabilirsin
  const index = (today.getFullYear() + today.getMonth() + today.getDate()) % QUOTES.length;
  return QUOTES[index];
}


/* ---------- Yardımcı zaman fonksiyonları ---------- */
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function startOfWeekMonday() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff); return d;
}
function startOfYear() { const d = new Date(); d.setHours(0,0,0,0); d.setMonth(0,1); return d; }
function startOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/* ---------- Tipler ---------- */
type Agg = Record<string, number>;

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_url: string | null;
  is_finished: boolean | null;
  status?: 'active' | 'paused' | 'finished' | null; // varsa kullanılır
  created_at: string;
  updated_at: string | null;
};

/* ---------- Renk paleti ---------- */
const COLORS = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#14B8A6','#F97316','#6366F1','#84CC16'];

// Sabit ders sırası
const SUBJECT_ORDER = [
  "Fen Bilimleri",
  "Matematik",
  "Türkçe",
  "Paragraf",
  "İngilizce",
  "T.C. İnkılap Tarihi",
  "Din Kültürü ve Ahlak Bilgisi",
];

// Bazı dersler için kısa label (grafik/legend'ta kullanacağız)
const SHORT_LABEL: Record<string, string> = {
  'Din Kültürü ve Ahlak Bilgisi': 'Din Kültürü',
  'T.C. İnkılap Tarihi': 'İnkılap Tarihi',
  // İstersen başka kısa etiketler de ekleyebilirsin:
  // 'T.C. İnkılap Tarihi': 'T.C. İnkılap Tar.',
};


/* ================================================================== */
/*                           ANA SAYFA COMPONENT                       */
/* ================================================================== */
export default function Home() {
  const [uid, setUid] = useState<string>();
  const [todayRecs, setTodayRecs] = useState<Rec[]>([]);
  const [allRecs, setAllRecs] = useState<Rec[]>([]);
  const [monthPages, setMonthPages] = useState(0);
  const [yearPages, setYearPages] = useState(0);
  const [monthBooks, setMonthBooks] = useState<number>(0);
  const [yearBooks,  setYearBooks]  = useState<number>(0);

  // NEW: günlük hedef
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id;
      setUid(id);
      if (!id) return;

      const today0Iso = startOfToday().toISOString();
      // --- AYLIK & YILLIK OKUMA TOPLAMLARI (reading_logs.pages) ---
      const m0 = startOfMonth();
      const y0 = startOfYear();
      
      /** BU AY biten kitap sayısı */
      {
        const { count: mCount, error: mErr } = await supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', id)
          .eq('is_finished', true)
          .gte('finished_at', m0.toISOString());

        if (!mErr) setMonthBooks(mCount ?? 0);
      }

      /** BU YIL biten kitap sayısı */
      {
        const { count: yCount, error: yErr } = await supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', id)
          .eq('is_finished', true)
          .gte('finished_at', y0.toISOString());

        if (!yErr) setYearBooks(yCount ?? 0);
      }

      // NEW: profiles.daily_goal çek
      {
        const { data: p } = await supabase
          .from('profiles')
          .select('daily_goal')
          .eq('id', id)
          .single();
        setDailyGoal(p?.daily_goal ?? null);
      }

      // Bugün (records)
      supabase.from('records')
        .select('id,created_at,subjects(name),question_count,duration_min,note,activity_date,off_calendar')
        .eq('user_id', id)
        .not('question_count', 'is', null)
        .or(`activity_date.gte.${today0Iso.slice(0,10)},and(activity_date.is.null,created_at.gte.${today0Iso})`)
        .eq('off_calendar', false)
        .order('created_at', { ascending: false })
        .returns<Rec[] & { activity_date?: string|null; off_calendar?: boolean }[]>()
        .then(({ data }) => setTodayRecs((data ?? []) as any));

      // Tüm records (grafikler)
      supabase.from('records')
        .select('id,created_at,subjects(name),question_count,activity_date,off_calendar')
        .eq('user_id', id)
        .not('question_count', 'is', null)
        .order('created_at', { ascending: false })
        .returns<Rec[] & { activity_date?: string|null; off_calendar?: boolean }[]>()
        .then(({ data }) => setAllRecs((data ?? []) as any));

        
    })();
  }, []);

  /* ---------- Grafik verileri ---------- */
  const today0 = startOfToday().getTime();
  const week0  = startOfWeekMonday().getTime();

  const bySubject = useMemo(() => {
    const agg = { today: {} as Agg, week: {} as Agg, total: {} as Agg };
    for (const r of allRecs as any[]) {
      const name = r.subjects?.name ?? 'Ders';
      const q = r.question_count ?? 0;
      if (q <= 0) continue;

      const t = r.activity_date
        ? new Date(r.activity_date + 'T00:00:00').getTime()
        : new Date(r.created_at).getTime();

      agg.total[name] = (agg.total[name] || 0) + q;
      if (r.off_calendar) continue;
      if (t >= week0)  agg.week[name]  = (agg.week[name]  || 0) + q;
      if (t >= today0) agg.today[name] = (agg.today[name] || 0) + q;
    }
    const names = Array.from(new Set([
      ...Object.keys(agg.total), ...Object.keys(agg.week), ...Object.keys(agg.today),
    ])).sort((a,b)=>(agg.total[b]||0)-(agg.total[a]||0));
    return { agg, names };
  }, [allRecs, today0, week0]);

  const weeklyTotal = Object.values(bySubject.agg.week).reduce(
  (sum, val) => sum + val,
  0
);

  const overallTotal = Object.values(bySubject.agg.total).reduce(
  (sum, val) => sum + val,
  0
);


  const todayTotal = useMemo(
    () => todayRecs.reduce((a, r) => a + (r.question_count ?? 0), 0),
    [todayRecs]
  );

  const pieData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of todayRecs as any[]) {
      const name = r.subjects?.name ?? 'Ders';
      const q = r.question_count ?? 0;
      if (q > 0) m[name] = (m[name] || 0) + q;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [todayRecs]);

  const nameToColor = useMemo(() => {
  const map: Record<string, string> = {};
  SUBJECT_ORDER.forEach((n, i) => { map[n] = COLORS[i % COLORS.length]; });
  return map;
}, []);


  // Haftalık: sadece > 0 olan dersler
const weeklyData = useMemo(() => (
  SUBJECT_ORDER
    .map((name) => ({ name, value: bySubject.agg.week[name] || 0 }))
    .filter((item) => item.value > 0)
), [bySubject]);

// Toplam: tüm dersler (0 olsa da listede)
const totalData = useMemo(() => (
  SUBJECT_ORDER.map((name) => ({ name, value: bySubject.agg.total[name] || 0 }))
), [bySubject]);


  /* ---------- Bar etiketleri / tooltip ---------- */
  const BarRightLabel = (props: any) => {
    const { x = 0, y = 0, width = 0, height = 0, value } = props;
    return (
      <text x={x + width + 6} y={y + height / 2 + 4} textAnchor="start" fill="#374151" fontSize={12}>
        {value}
      </text>
    );
  };
  const ValueOnlyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    return <div className="rounded-md border bg-white px-2 py-1 text-sm shadow-sm">{payload[0].value}</div>;
  };

  // NEW: progress hesapları
  const hasGoal = typeof dailyGoal === 'number' && dailyGoal! > 0;
  const progressPct = hasGoal ? Math.min(100, Math.round((todayTotal / (dailyGoal as number)) * 100)) : 0;
  const goalDone = hasGoal && todayTotal >= (dailyGoal as number);

  return (
    <main className="p-6 space-y-6">
      {/* === AKTİF KİTAPLAR (üstte) === */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2 className="text-xl font-semibold">Okuma Kitabım</h2>
          <p className="text-sm text-gray-500">
            {monthBooks > 0 && `Bu ay: ${monthBooks} kitap okudum`}
            {yearBooks > monthBooks && `${monthBooks > 0 ? ', ' : ''}Bu yıl: ${yearBooks} kitap okudum`}
            {(monthBooks === 0 && yearBooks === 0) && ''}
          </p>
        </div>

        <ActiveBooksInline />
      </section>

      {/* === GÜNLÜK (liste + pasta) === */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Sol: Günlük liste */}
        <div className="md:col-span-2 rounded-xl border bg-white p-4 shadow-sm space-y-2">
          {/* NEW: Başlık + Progress */}
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">
              Günün Soruları 
            </h2>

            {hasGoal && (
              <div className="w-full sm:w-80">
                <div className="text-s text-black mb-1 text-center">
                  Günlük hedefim: <b>{dailyGoal}</b> soru
                </div>
              <div
                className="relative h-6 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={dailyGoal as number}
                  aria-valuenow={Math.min(todayTotal, dailyGoal as number)}
                  aria-label="Günlük soru hedefi ilerleme"
                >
                  {/* dolu bar */}
                  <div
                    className={`absolute left-0 top-0 h-full transition-all duration-500
                    ${goalDone ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                  {/* yüzde / tebrik yazısı */}
                  <div className="absolute inset-0 grid place-items-center text-[14px] font-semibold text-black drop-shadow">
                    {goalDone ? '🎉 Tebrikler! Hedefini Tamamladın' : `Tamamlanan: ${progressPct}%`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <ul className="grid gap-2">
            {todayRecs.map((r) => (
              <li key={r.id} className="rounded-lg border p-3">
                <div className="flex justify-between items-center">
                  {/* Ders adı sola */}
                 <span className="font-medium">{r.subjects?.name ?? 'Ders'}</span>
                  {/* Soru sayısı sağa */}
                  <span className="font-bold">{r.question_count ?? 0} soru</span>
                </div>
                {r.note && <div className="text-sm text-gray-600 mt-1">{r.note}</div>}
              </li>
            ))}

            {todayRecs.length > 0 && (
              <li className="rounded-lg border p-3 bg-teal-300">
                <div className="flex justify-between items-center font-semibold">
                  <span>TOPLAM</span>
                  <span>{todayTotal} soru</span>
                </div>
              </li>
            )}

            {todayRecs.length === 0 && (
              <p className="text-sm text-gray-500">Bugün kayıt yok.</p>
            )}
        </ul>

          {/*<div className="text-right text-base text-gray-700">
            <b>TOPLAM: {todayTotal}</b>
          </div>*/}
        </div>

        {/* Sağ: Günlük pasta grafiği */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Günlük Dağılım</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, bottom: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="90%"
                  cy="58%"
                  label={renderPieLabel}   // ← kalıcı etiketler
                  labelLine={false}
                  minAngle={5}
                  
                >
                  {pieData.map((d, i) => (
                    <Cell key={d.name} fill={nameToColor[d.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip />
                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ marginBottom: -30 }} formatter={(value: string) => SHORT_LABEL[value] ?? value} />
              </PieChart>
            </ResponsiveContainer>

          </div>
        </div>
      </section>

      {/* === HAFTALIK & TOPLAM — YATAY ÇUBUK === */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Haftalık */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Bu Hafta {weeklyTotal} Soru Çözdüm </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={weeklyData}
                margin={{ left: 0, right: 56, top: 8, bottom: 8 }}
                barSize={22}
                barCategoryGap={16}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax + 10']} tickMargin={8} />
                <YAxis type="category" dataKey="name" width={65} interval={0} tick={{ fontSize: 12 }} tickFormatter={(n: string) => SHORT_LABEL[n] ?? n} />
                <RTooltip content={<ValueOnlyTooltip />} />
                <Bar dataKey="value" name="">
                  {weeklyData.map((d) => <Cell key={d.name} fill={nameToColor[d.name]} />)}
                  <LabelList dataKey="value" content={<BarRightLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Toplam */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Bu Yıl {overallTotal} Soru Çözdüm</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={totalData}
                margin={{ left: 0, right: 56, top: 8, bottom: 8 }}
                barSize={22}
                barCategoryGap={16}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax + 10']} tickMargin={8} />
                <YAxis type="category" dataKey="name" width={65} interval={0} tick={{ fontSize: 12 }} tickFormatter={(n: string) => SHORT_LABEL[n] ?? n} />
                <RTooltip content={<ValueOnlyTooltip />} />
                <Bar dataKey="value" name="">
                  {totalData.map((d) => <Cell key={d.name} fill={nameToColor[d.name]} />)}
                  <LabelList dataKey="value" content={<BarRightLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* === MOTİVASYON KÖŞESİ === */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        {(() => {
          const q = getTodayQuote();
          return (
            <div className="space-y-1">
              {/* metin: merkezde, italik */}
              <p className="text-center italic text-gray-800">“{q.text}”</p>
              {/* yazar: sağa hizalı */}
              <p className="text-right text-sm text-gray-600"><b>{q.author}</b></p>
            </div>
          );
        })()}
      </section>

    </main>
  );
}

/* ================================================================== */
/*           AKTİF KİTAPLAR – üstte liste + “Bugün okuduğum” girişi    */
/* ================================================================== */
function ActiveBooksInline() {
  const [rows, setRows] = useState<Book[]>([]);
  const [sumByTitle, setSumByTitle] = useState<Record<string, number>>({});
  const [lastPageByTitle, setLastPageByTitle] = useState<Record<string, number>>({});
  const [todayByTitle, setTodayByTitle] = useState<Record<string, number>>({}); // ← eklendi
  const [currentVals, setCurrentVals] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState<string | null>(null);
  const [uid, setUid] = useState<string | undefined>();

  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const currentUid = data.session?.user?.id;
      setUid(currentUid);
      if (!currentUid) return;

      // Aktif kitaplar
      const { data: books } = await supabase
        .from('books')
        .select('id,title,author,total_pages,cover_url,is_finished,status,created_at,updated_at')
        .order('created_at', { ascending: false });

      const active = (books ?? []).filter((b: any) =>
        (b.status ? b.status === 'active' : !b.is_finished)
      ) as Book[];
      setRows(active);

      // Okuma özetleri
      const { data: logs } = await supabase
        .from('reading_logs')
        .select('title,pages,page_number,created_at');

      const totalMap: Record<string, number> = {};
      const lastMap: Record<string, number> = {};
      const todayMap: Record<string, number> = {};

      const today0 = startOfToday().getTime();

      (logs ?? []).forEach((x: any) => {
        const t = (x.title || '').trim();
        if (!t) return;

        const p = Number(x.pages || 0);
        if (p > 0) {
          totalMap[t] = (totalMap[t] || 0) + p;
          if (new Date(x.created_at).getTime() >= today0) {
            todayMap[t] = (todayMap[t] || 0) + p;
          }
        }

        if (x.page_number != null) {
          const pn = Number(x.page_number);
          if (!Number.isNaN(pn)) lastMap[t] = Math.max(lastMap[t] || 0, pn);
        }
      });

      setSumByTitle(totalMap);
      setLastPageByTitle(lastMap);
      setTodayByTitle(todayMap);
    })();
  }, []);

  // Kaldığım sayfa kaydet
  async function setCurrentPage(b: Book) {
    const raw = (currentVals[b.id] || '').trim();
    const current = Number(raw);
    if (!uid) return alert('Oturum bulunamadı.');
    if (!raw || isNaN(current) || current < 0) return alert('Geçerli bir sayfa girin');

    const alreadyRead = sumByTitle[b.title] || 0;
    const delta = current - alreadyRead;
    if (delta <= 0) {
      return alert(`Girilen sayfa (${current}) mevcut toplam okumanın (${alreadyRead}) altında. Daha yüksek bir değer girin.`);
    }
    if (b.total_pages && current > b.total_pages) {
      if (!confirm(`Girilen sayfa (${current}), toplam sayfayı (${b.total_pages}) aşıyor. Yine de kaydedilsin mi?`)) return;
    }

    setSaveBusy(b.id);
    try {
      const { error } = await supabase.from('reading_logs').insert({
        user_id: uid,
        title: b.title,
        pages: delta,
        page_number: current,
      });
      if (error) throw error;

      // UI
      setSumByTitle((s) => ({ ...s, [b.title]: (s[b.title] || 0) + delta }));
      setLastPageByTitle((s) => ({ ...s, [b.title]: current }));
      setTodayByTitle((s) => ({ ...s, [b.title]: (s[b.title] || 0) + delta }));
      setCurrentVals((s) => ({ ...s, [b.id]: '' }));
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaveBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">Aktif kitap yok.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((b) => {
        const read = sumByTitle[b.title] || 0;
        const total = b.total_pages || 0;
        const remain = total ? Math.max(total - read, 0) : null;
        const pct = total ? Math.min(100, Math.round((read / total) * 100)) : null;
        const inputId2 = `curr-${b.id}`;
        const lastPage = lastPageByTitle[b.title];
        const today = todayByTitle[b.title] || 0;

        return (
          <li key={b.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              {/* Kapak */}
              <div className="h-16 w-12 overflow-hidden rounded bg-gray-100 border shrink-0">
                {b.cover_url ? (
                  <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-xl">📘</div>
                )}
              </div>

              {/* Başlık + ilerleme */}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {b.title}{b.author ? <span className="text-gray-500"> — {b.author}</span> : null}
                </div>
                <div className="text-xs mb-1 mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {total
                      ? <>Okunan: <b>{read}</b> · Kalan: <b>{remain}</b> · Biten: <b>%{pct}</b></>
                      : <>Okunan: <b>{read}</b></>}
                  </span>
                  {lastPage != null && <span>Kaldığım Sayfa: <b>{lastPage}</b></span>}
                  <span className="text-emerald-700">Bugün Okuduğum: <b>{today}</b></span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="absolute left-0 top-0 h-2 rounded-full bg-indigo-500"
                    style={{ width: pct ? `${pct}%` : (read > 0 ? '8%' : '0%') }}
                  />
                </div>
              </div>

              {/* Sağ: Kaldığım sayfa giriş */}
              <div className="flex flex-col items-start gap-2 shrink-0">
                <label htmlFor={inputId2} className="text-sm font-medium text-gray-700">
                  Kaldığım sayfa:
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={inputId2}
                    type="number"
                    min={0}
                    placeholder={lastPage != null ? `Örn. ${lastPage + 5}` : 'Sayfa'}
                    className="w-28 rounded border p-1 text-sm"
                    value={currentVals[b.id] ?? ''}
                    onChange={(e) => setCurrentVals((s) => ({ ...s, [b.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => setCurrentPage(b)}
                    disabled={saveBusy === b.id}
                    className="rounded bg-green-600 text-white px-3 py-1 text-sm hover:bg-green-700"
                  >
                    {saveBusy === b.id ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
