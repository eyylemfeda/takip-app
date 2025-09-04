'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Rec } from '@/types';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList
} from 'recharts';
import { QUOTES } from '@/data/quotes';
import { createClient } from '@/lib/supabase/client';

const RAD = Math.PI / 180;
function renderPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, value,
}: any) {
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
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
function startOfMonth() { const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d; }
// 01:00'da başlayan "gün" için YYYY-MM-DD anahtarı
function dayKey01() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(1, 0, 0, 0);          // bugün 01:00
  if (now < start) start.setDate(start.getDate() - 1); // 01:00'dan önceyse bir önceki gün
  const isoLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString();
  return isoLocal.slice(0, 10);        // YYYY-MM-DD
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
  status?: 'active' | 'paused' | 'finished' | null;
  created_at: string;
  updated_at: string | null;
};

/* ---------- Renk paleti ---------- */
const COLORS = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#14B8A6','#F97316','#6366F1','#84CC16'];

const SUBJECT_ORDER = [
  "Fen Bilimleri",
  "Matematik",
  "Türkçe",
  "Paragraf",
  "İngilizce",
  "T.C. İnkılap Tarihi",
  "Din Kültürü ve Ahlak Bilgisi",
];

const SHORT_LABEL: Record<string, string> = {
  'Din Kültürü ve Ahlak Bilgisi': 'Din Kültürü',
  'T.C. İnkılap Tarihi': 'İnkılap Tarihi',
};

/* ================================================================== */
/*                           ANA SAYFA COMPONENT                       */
/* ================================================================== */
export default function Home() {
  const supabase = createClient();

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

      // 🔸 Günün (01:00–01:00) tarihi
      const dayKey = dayKey01();

      // Bugün (records) — sadece takvimli kayıtlar, activity_date == dayKey
      {
        const { data: todayData, error: todayErr } = await supabase
          .from('records')
          .select('id,created_at,subjects(name),question_count,duration_min,note,activity_date,off_calendar')
          .eq('user_id', id)
          .not('question_count', 'is', null)
          .eq('off_calendar', false)
          .eq('activity_date', dayKey)     // ← 01:00 gün anahtarı
          .order('created_at', { ascending: false });

        if (!todayErr) setTodayRecs((todayData ?? []) as any);
        else console.error('todayErr', todayErr);
      }

      // Tüm records (grafikler)
      {
        const { data: allData, error: allErr } = await supabase
          .from('records')
          .select('id,created_at,subjects(name),question_count,activity_date,off_calendar')
          .eq('user_id', id)
          .not('question_count', 'is', null)
          .order('created_at', { ascending: false });

        if (!allErr) setAllRecs((allData ?? []) as any);
        else console.error('allErr', allErr);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Grafik verileri ---------- */
  const dayKey = useMemo(() => dayKey01(), []); // "YYYY-MM-DD", gün 01:00'da başlar
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
      if (r.activity_date === dayKey) agg.today[name] = (agg.today[name] || 0) + q;
    }
    const names = Array.from(new Set([
      ...Object.keys(agg.total), ...Object.keys(agg.week), ...Object.keys(agg.today),
    ])).sort((a,b)=>(agg.total[b]||0)-(agg.total[a]||0));
    return { agg, names };
  }, [allRecs, today0, week0, dayKey]);

  const weeklyTotal = Object.values(bySubject.agg.week).reduce((sum, val) => sum + val, 0);
  const overallTotal = Object.values(bySubject.agg.total).reduce((sum, val) => sum + val, 0);

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

  const weeklyData = useMemo(() => (
    SUBJECT_ORDER
      .map((name) => ({ name, value: bySubject.agg.week[name] || 0 }))
      .filter((item) => item.value > 0)
  ), [bySubject]);

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
    <main className="mx-auto max-w-none md:max-w-5xl px-1 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* === AKTİF KİTAPLAR (üstte) === */}
      <section className="rounded-xl border bg-white px-2 pt-1 pb-2 shadow-sm">
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
        <div className="md:col-span-2 rounded-xl border bg-white px-2 pt-1 pb-2 shadow-sm space-y-2">
          {/* NEW: Başlık + Progress */}
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Günün Soruları</h2>

            {hasGoal && (
              <div className="w-full sm:w-80 md:mt-2">
                <div
                  className="relative h-6 mb-2 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={dailyGoal as number}
                  aria-valuenow={Math.min(todayTotal, dailyGoal as number)}
                  aria-label="Günlük soru hedefi ilerleme"
                >
                  <div
                    className={`absolute left-0 top-0 h-full transition-all duration-500
                    ${goalDone ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                  <div className="absolute inset-0 grid place-items-center text-[14px] font-semibold text-black drop-shadow">
                    {goalDone ? '🎉 Tebrikler! Hedefini Tamamladın' : `Günlük Hedef: ${dailyGoal} Soru, Tamamlanan: % ${progressPct}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <ul className="grid gap-2">
            {todayRecs.map((r) => (
              <li key={r.id} className="rounded-lg border p-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{r.subjects?.name ?? 'Ders'}</span>
                  <span className="font-bold">{r.question_count ?? 0} soru</span>
                </div>
                {r.note && <div className="text-sm text-gray-600 mt-1">{r.note}</div>}
              </li>
            ))}

            {todayRecs.length > 0 && (
              <li className="rounded-lg border p-1 bg-teal-300">
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
        </div>

        {/* Sağ: Günlük pasta grafiği */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-xl sm:text-xl font-semibold mb-2">Günlük Dağılım</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, bottom: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="90%"
                  cy="58%"
                  label={renderPieLabel}
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
              <p className="text-center italic text-gray-800">“{q.text}”</p>
              <p className="text-right text-sm text-gray-600"><b>{q.author}</b></p>
            </div>
          );
        })()}
      </section>
    </main>
  );
}

/* ================================================================== */
/*           AKTİF KİTAPLAR – tek kart + “Bugün okuduğum” girişi       */
/* ================================================================== */
function ActiveBooksInline() {
  const supabase = createClient();

  const [rows, setRows] = useState<Book[]>([]);
  const [sumByTitle, setSumByTitle] = useState<Record<string, number>>({});
  const [lastPageByTitle, setLastPageByTitle] = useState<Record<string, number>>({});
  const [todayByTitle, setTodayByTitle] = useState<Record<string, number>>({});
  const [currentVals, setCurrentVals] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState<string | null>(null);
  const [uid, setUid] = useState<string | undefined>();

  function startOfTodayLocal() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const currentUid = data.session?.user?.id;
      setUid(currentUid);
      if (!currentUid) return;

      // Kitaplar
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

      const today0 = startOfTodayLocal().getTime();

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
  }, [supabase]);

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

  // İlk aktif kitapla tek kart
  const b = rows[0];
  const read = sumByTitle[b.title] || 0;
  const total = b.total_pages || 0;
  const remain = total ? Math.max(total - read, 0) : null;
  const pct = total ? Math.min(100, Math.round((read / total) * 100)) : null;
  const lastPage = lastPageByTitle[b.title];
  const today = todayByTitle[b.title] || 0;
  const inputId2 = `curr-${b.id}`;

  return (
    <div className="rounded-xl bg-white">
      <div className="flex items-start gap-3">
        {/* Kapak – mobilde daha geniş görünüm */}
        <div className="h-[130px] w-[110px] overflow-hidden rounded border bg-gray-100 shrink-0">
          {b.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xl">📘</div>
          )}
        </div>

        {/* Bilgiler */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{b.title}</div>
          <div className="truncate text-xs text-gray-600">{b.author ?? '-'}</div>

          <div className="mt-1 grid gap-1 text-xs">
            <div className="text-emerald-700 text-sm font-semibold">
              Bugün Okunan: <b>{today}</b> Sayfa
            </div>
            <div>
              Toplam Okunan: <b>{read}</b>{total ? <> · Kalan: <b>{remain}</b></> : null}
            </div>
          </div>

          {/* Progress Bar — daha yüksek, iç yazılı, zemin beyaz, ilerleme turuncu */}
          <div
            className="mt-1 relative w-full overflow-hidden rounded-full border bg-white h-5 sm:h-6"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total || 0}
            aria-valuenow={read}
            aria-label="Kitap ilerleme yüzdesi"
          >
            {/* dolu kısım */}
            <div
              className="absolute left-0 top-0 h-full rounded-none bg-orange-500 transition-all duration-500"
              style={{ width: pct ? `${pct}%` : (read > 0 ? '4px' : '0px') }}
            />
            {/* yüzde metni */}
            <div className="absolute inset-0 grid place-items-center text-[12px] sm:text[13px] font-semibold">
              {total ? <>İlerleme: %{pct}</> : 'Toplam sayfa yok'}
            </div>
          </div>

          {/* Kaldığım sayfayı ekle */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-900">Kaldığım Sayfa:</span>
            <div className="flex items-center gap-2">
              <label htmlFor={inputId2} className="sr-only">Kaldığım sayfa</label>
              <input
                id={inputId2}
                type="number"
                inputMode="numeric"
                placeholder={lastPage != null ? String(lastPage) : 'Örn. 185'}
                className="w-12 h-7 rounded border px-2 text-sm"
                value={currentVals[b.id] ?? ''}
                onChange={(e) => setCurrentVals((s) => ({ ...s, [b.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') setCurrentPage(b); }}
              />
              <button
                onClick={() => setCurrentPage(b)}
                disabled={saveBusy === b.id}
                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
              >
                {saveBusy === b.id ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
