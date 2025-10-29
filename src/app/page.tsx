'use client';

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Rec } from '@/types';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList
} from 'recharts';
import { QUOTES } from '@/data/quotes';
//import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';//

const RAD = Math.PI / 180;
function renderPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, value,
}: any) {
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600}>
      {value}
    </text>
  );
}

function getTodayQuote() {
  const today = new Date();
  const index = (today.getFullYear() + today.getMonth() + today.getDate()) % QUOTES.length;
  return QUOTES[index];
}

/* ---------- Zaman yardımcıları ---------- */
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function startOfWeekMonday() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff); return d;
}
function startOfYear() { const d = new Date(); d.setHours(0,0,0,0); d.setMonth(0,1); return d; }
function startOfMonth() { const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d; }
// Lokal takvim günü (00:00–23:59) → YYYY-MM-DD
function todayLocalISODate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
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
// 🔒 Oturum + aktiflik koruması
  //const { uid, loading } = useRequireActiveUser();//

  // EKLENECEK KOD BAŞLANGICI
//const [uid, setUid] = useState<string | null>(null);
//const [loading, setLoading] = useState(true); // Sayfa başlangıçta yükleniyor

//useEffect(() => {
  //async function getUserSession() {
    // Supabase'in oturumu tarayıcıdan (localStorage)
    // güvenle yüklemesini bekler
    //const { data, error } = await supabase.auth.getUser(); 29.10.2025 değişikliği ile yoruma alındı

    //if (error) {
     // console.error('Oturum alınırken hata:', error);
      //setLoading(false);
      // Merak etmeyin, AuthListener (Kaptan 1)
      // zaten kullanıcıyı /login'e atacaktır.
     // return;
   // }

  //  if (data.user) {
  //    setUid(data.user.id);
 //   }

    // Oturum kontrolü bitti (isterse 'null' olsun).
    // Artık sayfa yüklenebilir.
  //  setLoading(false);
  //}

  // Bu fonksiyonu sadece sayfa ilk açıldığında bir kez çalıştır
 // getUserSession();
//}, []);
// EKLENECEK KOD BİTİŞİ
  const { uid, loading } = useAuth();
  const [todayRecs, setTodayRecs] = useState<Rec[]>([]);
  const [allRecs, setAllRecs] = useState<Rec[]>([]);
  const [monthBooks, setMonthBooks] = useState<number>(0);
  const [yearBooks,  setYearBooks]  = useState<number>(0);

  // Günlük hedef
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;

    (async () => {
      const m0 = startOfMonth();
      const y0 = startOfYear();

      // BU AY biten kitap
      {
        const { count: mCount } = await supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_finished', true)
          .gte('finished_at', m0.toISOString());
        setMonthBooks(mCount ?? 0);
      }

      // BU YIL biten kitap
      {
        const { count: yCount } = await supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_finished', true)
          .gte('finished_at', y0.toISOString());
        setYearBooks(yCount ?? 0);
      }

      // günlük hedef
      {
        const { data: p } = await supabase
          .from('profiles')
          .select('daily_goal')
          .eq('id', uid)
          .single();
        setDailyGoal(p?.daily_goal ?? null);
      }

      // Bugün (records)
      {
        const dayKey = todayLocalISODate();
        const { data } = await supabase
          .from('records')
          .select(`
            id, created_at, activity_date, off_calendar,
            subject_id, topic_id,
            subjects(name),
            topics(name),
            question_count, duration_min, note
          `)
          .eq('user_id', uid)
          .not('question_count', 'is', null)
          .eq('off_calendar', false)
          .eq('activity_date', dayKey)
          .order('created_at', { ascending: false })
          .returns<Rec[] & { activity_date?: string|null; off_calendar?: boolean }[]>();
        setTodayRecs((data ?? []) as any);
      }

      // Tüm records (grafikler)
      {
        const { data } = await supabase
          .from('records')
          .select('id,created_at,subjects(name),question_count,activity_date,off_calendar')
          .eq('user_id', uid)
          .not('question_count', 'is', null)
          .order('created_at', { ascending: false })
          .returns<Rec[] & { activity_date?: string|null; off_calendar?: boolean }[]>();
        setAllRecs((data ?? []) as any);
      }
    })();
  }, [uid]);

  /* ---------- Grafik / özet verileri ---------- */
  const dayKey = useMemo(() => todayLocalISODate(), []);
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
      if (t >= week0) agg.week[name] = (agg.week[name] || 0) + q;
      if (r.activity_date === dayKey) agg.today[name] = (agg.today[name] || 0) + q;
    }
    const names = Array.from(new Set([
      ...Object.keys(agg.total), ...Object.keys(agg.week), ...Object.keys(agg.today),
    ])).sort((a,b)=>(agg.total[b]||0)-(agg.total[a]||0));
    return { agg, names };
  }, [allRecs, week0, dayKey]);

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

  /* ---------- Günün Soruları: ders bazında gruplama + Konuları göster ---------- */
  type Row = {
    id: string;
    off_calendar?: boolean | null;
    subject_id?: string | null;
    topic_id?: string | null;
    subjects?: { name: string } | null;
    topics?: { name: string } | null;
    question_count?: number | null;
    duration_min?: number | null;
    note?: string | null;
  };

  // Varsayılan: konular açık
  const [showTopics, setShowTopics] = useState(true);

  const subjectGroups = useMemo(() => {
    const bySub = new Map<
      string,
      {
        subjectName: string;
        totalQuestions: number;
        sessions: Row[];
        topics: Map<string, { name: string; totalQuestions: number }>;
      }
    >();

    for (const r of (todayRecs as unknown as Row[])) {
      if (!r || r.off_calendar) continue;

      const subjectName = r.subjects?.name ?? 'Diğer';
      const subjectKey = r.subject_id ?? subjectName;

      if (!bySub.has(subjectKey)) {
        bySub.set(subjectKey, {
          subjectName,
          totalQuestions: 0,
          sessions: [],
          topics: new Map(),
        });
      }
      const g = bySub.get(subjectKey)!;

      const q = r.question_count ?? 0;
      g.totalQuestions += q;
      g.sessions.push(r);

      const topicName = r.topics?.name ?? null;
      if (topicName) {
        const topicKey = r.topic_id ?? topicName;
        const cur = g.topics.get(topicKey) ?? { name: topicName, totalQuestions: 0 };
        cur.totalQuestions += q;
        g.topics.set(topicKey, cur);
      }
    }

    // Dersleri toplam soruya göre sırala
    return Array.from(bySub.values()).sort((a, b) => b.totalQuestions - a.totalQuestions);
  }, [todayRecs]);

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

  // Günlük hedef ilerleme
  const hasGoal = typeof dailyGoal === 'number' && dailyGoal! > 0;
  const progressPct = hasGoal ? Math.min(100, Math.round((todayTotal / (dailyGoal as number)) * 100)) : 0;
  const goalDone = hasGoal && todayTotal >= (dailyGoal as number);

  // 🔄 Guard
  if (loading) {
    return (
      <main className="mx-auto max-w-none md:max-w-5xl px-4 py-6">
        <p className="text-sm text-gray-600">Yükleniyor…</p>
      </main>
    );
  }
  if (!uid) return null; // kanca /login'e yönlendirdi

  return (
    <main className="mx-auto max-w-none md:max-w-5xl px-0 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* === AKTİF KİTAPLAR === */}
      <section className="rounded-xl border bg-white px-2 pt-1 pb-2 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2 className="text-xl font-semibold">Okuma Kitabım</h2>
          <p className="text-sm text-gray-500">
            {monthBooks > 0 && `Bu ay: ${monthBooks} kitap okudum`}
            {yearBooks > monthBooks && `${monthBooks > 0 ? ', ' : ''}Bu yıl: ${yearBooks} kitap okudum`}
          </p>
        </div>
        <ActiveBooksInline uid={uid}/>
      </section>

      {/* === GÜNLÜK (liste + pasta) === */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Sol: Günlük liste (Ders bazında gruplu) */}
        <div className="md:col-span-2 rounded-xl border bg-white px-2 pt-1 pb-2 shadow-sm space-y-2">
          {/* Başlık + Progress */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Günün Soruları</h2>

              {hasGoal && (
                <div className="w-full sm:w-80">
                  <div
                    className="relative h-6 w-full overflow-hidden rounded-md border border-gray-600 bg-gray-100"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={dailyGoal as number}
                    aria-valuenow={Math.min(todayTotal, dailyGoal as number)}
                    aria-label="Günlük soru hedefi ilerleme"
                  >
                    <div
                      className={`absolute left-0 top-0 h-full transition-[width] duration-500
                        ${goalDone ? 'bg-emerald-600' : 'bg-cyan-300'}`} //burada amber rengi progress bar rengi
                      style={{ width: `${progressPct}%` }}
                    />
                    <div className="absolute inset-0 grid place-items-center text-[13px] font-semibold text-black/95"> {/*yazıyı siyah yaptık*/}
                      {goalDone
                        ? '🎉 Hedef tamam!'
                        : `Hedef ${dailyGoal} · Biten %${progressPct}`}
                    </div>
                  </div>
                </div>
              )}
            </div>


          {/* DERS BAZINDA LİSTE */}
          {subjectGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <span className="text-2xl mb-2">🎯</span>
              <p className="text-sm text-center">
                Bugün henüz soru girişi yapılmadı. <br />
                <span className="text-emerald-600 font-medium">
                  Hadi, çözdüğün soruları girmeye başla ve <br /> günlük hedefine ilerle!
                </span>
              </p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {subjectGroups.map((g, i) => (
                <li key={i} className="rounded-lg border p-2">
                  <div className="flex justify-between items-center">
                    {/* Sol: Ders adı */}
                    <span className="font-medium">{g.subjectName}</span>
                    {/* Sağ: NN soru (aynı font/kalınlık) */}
                    <span className="font-medium">{g.totalQuestions} soru</span>
                  </div>

                  {/* Konular – varsayılan AÇIK */}
                  {showTopics && g.topics.size > 0 && (
                    <ul className="mt-1 text-sm text-gray-700">
                      {Array.from(g.topics.values()).map((t, idx) => (
                        <li key={idx} className="pl-4">- {t.name}: {t.totalQuestions}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}

              {/* TOPLAM (sağda aynı hizada) */}
              <li className="rounded-lg border p-1 bg-lime-300">
                <div className="flex justify-between items-center font-semibold">
                  <span>TOPLAM</span>
                  <span>{todayTotal} soru</span>
                </div>
              </li>
            </ul>
          )}

          {/* Anahtar: Konuları göster (varsayılan açık) */}
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showTopics}
                onChange={(e) => setShowTopics(e.target.checked)}
                className="h-4 w-4"
              />
              Konuları göster
            </label>
          </div>
        </div>

        {/* Sağ: Günlük pasta grafiği */}
        {pieData && pieData.length > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-xl sm:text-xl font-semibold mb-0">Günlük Dağılım</h3>
            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: -6, right: 0, bottom: 28, left: 0 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius="82%"
                    cy="52%"            // grafiği çok aşağı itmeden ortala
                    label={renderPieLabel}
                    labelLine={false}
                    minAngle={5}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={d.name} fill={nameToColor[d.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip />

                  {/* Negatif margin'i kaldır; belirgin bir yükseklik ver ki taşmasın */}
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    height={22}                      // alt boşluğu rezerve eder
                    wrapperStyle={{ marginTop: 2 }}  // çok az yukarı çek
                    formatter={(value: string) => SHORT_LABEL[value] ?? value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
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
                data={SUBJECT_ORDER
                  .map((name) => ({ name, value: bySubject.agg.week[name] || 0 }))
                  .filter((item) => item.value > 0)}
                margin={{ left: 0, right: 56, top: 8, bottom: 8 }}
                barSize={22}
                barCategoryGap={16}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax + 10']} tickMargin={8} />
                <YAxis type="category" dataKey="name" width={65} interval={0} tick={{ fontSize: 12 }} tickFormatter={(n: string) => SHORT_LABEL[n] ?? n} />
                <RTooltip content={<ValueOnlyTooltip />} />
                <Bar dataKey="value" name="">
                  {SUBJECT_ORDER
                    .map((name) => ({ name, value: bySubject.agg.week[name] || 0 }))
                    .filter((item) => item.value > 0)
                    .map((d) => <Cell key={d.name} fill={nameToColor[d.name]} />)}
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
                data={SUBJECT_ORDER.map((name) => ({ name, value: bySubject.agg.total[name] || 0 }))}
                margin={{ left: 0, right: 56, top: 8, bottom: 8 }}
                barSize={22}
                barCategoryGap={16}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax + 10']} tickMargin={8} />
                <YAxis type="category" dataKey="name" width={65} interval={0} tick={{ fontSize: 12 }} tickFormatter={(n: string) => SHORT_LABEL[n] ?? n} />
                <RTooltip content={<ValueOnlyTooltip />} />
                <Bar dataKey="value" name="">
                  {SUBJECT_ORDER.map((name) => ({ name, value: bySubject.agg.total[name] || 0 }))
                    .map((d) => <Cell key={d.name} fill={nameToColor[d.name]} />)}
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
      {/* === ALT BİLGİ / FOOTER === */}
      <footer className="text-center text-xs text-gray-500 mt-4 pb-4">
        © {new Date().getFullYear()} — <span className="font-medium text-gray-700">derstakibim.com</span> ve Öğrenci Takip Uygulamasının tüm hakları <span className="font-medium text-gray-700">Hakan OBALI</span> 'ya aittir.
      </footer>
    </main>
  );
}


/* ================================================================== */
/*           AKTİF KİTAPLAR – tek kart + “Bugün okuduğum” girişi       */
function ActiveBooksInline({ uid }: { uid: string | null }) {
  // const { uid } = useRequireActiveUser(); // <-- BU SATIRI TAMAMEN SİLİN
  const [rows, setRows] = useState<Book[]>([]);
  const [sumByTitle, setSumByTitle] = useState<Record<string, number>>({});
  const [lastPageByTitle, setLastPageByTitle] = useState<Record<string, number>>({});
  const [todayByTitle, setTodayByTitle] = useState<Record<string, number>>({});
  const [currentVals, setCurrentVals] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState<string | null>(null);

  function startOfTodayLocal() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  useEffect(() => {
    if (!uid) return;

    (async () => {
      // Kitaplar — SADECE bu kullanıcı
      const { data: books } = await supabase
        .from('books')
        .select('id,title,author,total_pages,cover_url,is_finished,status,created_at,updated_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      const active = (books ?? []).filter((b: any) =>
        (b.status ? b.status === 'active' : !b.is_finished)
      ) as Book[];
      setRows(active);

      // Okuma özetleri — SADECE bu kullanıcı
      const { data: logs } = await supabase
        .from('reading_logs')
        .select('title,pages,page_number,created_at')
        .eq('user_id', uid);

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
  }, [uid]);

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
        {/* Kapak — yalnızca PC'de büyütüldü */}
        <div className="h-[140px] w-[110px] md:h-[85px] md:w-[70px] overflow-hidden rounded border bg-gray-100 shrink-0">
          {b.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xl">📘</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* === Başlık + Yazar === */}
          {/* Mobil: mevcut iki satır (hiç değişmedi) */}
          <div className="md:hidden">
            <div className="truncate text-sm font-medium">{b.title}</div>
            <div className="truncate text-xs text-gray-600">{b.author ?? '-'}</div>
          </div>
          {/* PC: tek satırda başlık — yazar */}
          <div className="hidden md:flex items-baseline gap-2">
            <div className="truncate text-sm font-medium">{b.title}</div>
            <span className="text-xs text-gray-600 shrink-0">— {b.author ?? '-'}</span>
          </div>

          {/* === Bilgiler Satırı === */}
          {/* Mobil: eski iki satır (değişmedi) */}
          <div className="mt-1 grid gap-1 text-xs md:hidden">
            <div className="text-emerald-700 text-sm font-semibold">
              Bugün Okunan: <b>{today}</b> Sayfa
            </div>
            <div>
              Toplam Okunan: <b>{read}</b>{total ? <> · Kalan: <b>{remain}</b></> : null}
            </div>
          </div>
          {/* PC: üç değer tek satır */}
          <div className="hidden md:flex items-center gap-4 mt-1 text-xs">
            <div className="text-emerald-700 text-sm font-semibold">
              Bugün Okunan: <b>{today}</b> Sayfa
            </div>
            <div>Toplam Okunan: <b>{read}</b> Sayfa</div>
            {total ? <div>Kalan: <b>{remain}</b> Sayfa</div> : null}
          </div>

          {/* === Progress bar + Kaldığım Sayfa (PC sağda, mobil altta) === */}
          <div className="mt-1 md:flex md:items-center md:gap-3">
            {/* Progress bar */}
            <div
              className="relative w-full overflow-hidden rounded-full border bg-white h-5 sm:h-6 md:flex-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total || 0}
              aria-valuenow={read}
              aria-label="Kitap ilerleme yüzdesi"
            >
              <div
                className="absolute left-0 top-0 h-full rounded-none bg-amber-400 transition-all duration-500"
                style={{ width: pct ? `${pct}%` : (read > 0 ? '4px' : '0px') }}
              />
              <div className="absolute inset-0 grid place-items-center text-[12px] sm:text-[13px] font-semibold">
                {total ? <>İlerleme: %{pct}</> : 'Toplam sayfa yok'}
              </div>
            </div>

            {/* MOBİL: barın ALTINDA (görünür), PC’de gizli */}
            <div className="mt-1 flex items-center justify-between gap-2 md:hidden">
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

            {/* PC: barın SAĞINDA (görünür), mobilde gizli */}
            <div className="mt-1 hidden md:flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-900">Kaldığım Sayfa:</span>
              <label htmlFor={inputId2} className="sr-only">Kaldığım sayfa</label>
              <input
                id={inputId2}
                type="number"
                inputMode="numeric"
                placeholder={lastPage != null ? String(lastPage) : 'Örn. 185'}
                className="w-14 h-7 rounded border px-2 text-sm"
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
