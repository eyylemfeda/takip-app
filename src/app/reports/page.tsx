'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

/* ========= Tipler ========= */
type SelectOption = { id: string; name: string };

// Veritabanından gelen ham kayıt (Sadece ID'ler)
type RawRecord = {
  question_count: number;
  subject_id: string | null;
  topic_id: string | null;
  source_id: string | null; // veritabanındaki adıyla
};

// İşlenmiş Rapor Satırı (İsimler)
type StudentReportRow = {
  question_count: number;
  subject_name: string;
  topic_name: string;
  source_name: string;
};

// Hiyerarşik veri yapıları
type SourceMap = Map<string, number>;
type TopicMap = Map<string, { total: number; sources: SourceMap }>;
type SubjectMap = Map<string, { total: number; topics: TopicMap }>;

/* ========= Tarih Yardımcıları ========= */
function toISODate(d: Date): string { return d.toISOString().split('T')[0]; }
const DATES = {
  today: { start: toISODate(new Date(new Date().setHours(0,0,0,0))), end: toISODate(new Date()) },
  yesterday: { start: toISODate(new Date(new Date().setDate(new Date().getDate()-1))), end: toISODate(new Date(new Date().setDate(new Date().getDate()-1))) },
  week: { start: (() => { const d = new Date(); d.setHours(0,0,0,0); const diff = d.getDay()===0?-6:1-d.getDay(); d.setDate(d.getDate()+diff); return toISODate(d); })(), end: toISODate(new Date()) },
  month: { start: toISODate(new Date(new Date().setDate(1))), end: toISODate(new Date()) },
};

/* ============================================== */
/* ÖĞRENCİ RAPOR SAYFASI BİLEŞENİ     */
/* ============================================== */
export default function StudentReportPage() {
  const { uid, loading: authLoading } = useAuth();

  // --- REFERANS HARİTALARI (ID -> İsim eşleştirmesi için) ---
  const [subjectsMap, setSubjectsMap] = useState<Map<string, string>>(new Map());
  const [topicsMap, setTopicsMap] = useState<Map<string, string>>(new Map());
  const [sourcesMap, setSourcesMap] = useState<Map<string, string>>(new Map());

  // Filtre Listeleri (Dropdownlar için)
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [topics, setTopics] = useState<SelectOption[]>([]);
  const [sources, setSources] = useState<SelectOption[]>([]);

  // Seçili Filtreler
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  const [dateRangePreset, setDateRangePreset] = useState('today');
  const [customDate, setCustomDate] = useState(toISODate(new Date()));
  const [customRange, setCustomRange] = useState({ start: toISODate(new Date()), end: toISODate(new Date()) });

  const [reportRows, setReportRows] = useState<StudentReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. REFERANS VERİLERİNİ ÇEK (Sayfa Yüklendiğinde)
  useEffect(() => {
    if (authLoading || !uid) return;

    (async () => {
      // Dersler
      const { data: subData } = await supabase.from('subjects').select('id, name').order('name');
      if (subData) {
        setSubjects(subData);
        setSubjectsMap(new Map(subData.map(s => [s.id, s.name])));
      }

      // Konular (Tümü)
      const { data: topData } = await supabase.from('topics').select('id, name').order('name');
      if (topData) {
        setTopicsMap(new Map(topData.map(t => [t.id, t.name])));
        // Başlangıçta dropdown boş olabilir veya tümü gelebilir,
        // burada tümünü haritalamak önemli.
      }

      // Kaynaklar (Sadece bu öğrencinin)
      const { data: srcData } = await supabase.from('sources').select('id, name').eq('user_id', uid).order('name');
      if (srcData) {
        setSourcesMap(new Map(srcData.map(s => [s.id, s.name])));
      }
    })();
  }, [uid, authLoading]);

  // 2. KADEMELİ FİLTRE (Dropdown İçeriklerini Güncelle)
  useEffect(() => {
    if (!uid) return;

    if (selectedSubject === 'all') {
      setTopics([]);
      setSources([]);
      setSelectedTopic('all');
      setSelectedSource('all');
      return;
    }

    // Konuları güncelle
    supabase.from('topics').select('id, name').eq('subject_id', selectedSubject).order('name')
      .then(({ data }) => setTopics(data ?? []));

    // Kaynakları güncelle (Sadece bu öğrencinin)
    supabase.from('sources').select('id, name')
      .eq('subject_id', selectedSubject)
      .eq('user_id', uid)
      .order('name')
      .then(({ data }) => setSources(data ?? []));

  }, [selectedSubject, uid]);

  // 3. RAPOR GETİR (MANUEL BİRLEŞTİRME)
  async function handleFetchReport() {
    setError(null); setLoading(true); setReportRows([]);

    // Tarih
    let start: string | null = null, end: string | null = null;
    if (dateRangePreset === 'today') { start = DATES.today.start; end = DATES.today.end; }
    else if (dateRangePreset === 'yesterday') { start = DATES.yesterday.start; end = DATES.yesterday.end; }
    else if (dateRangePreset === 'week') { start = DATES.week.start; end = DATES.week.end; }
    else if (dateRangePreset === 'month') { start = DATES.month.start; end = DATES.month.end; }
    else if (dateRangePreset === 'custom') { start = customDate; end = customDate; }
    else if (dateRangePreset === 'customRange') { start = customRange.start; end = customRange.end; }

    // SORGULAMA: Sadece ID'leri çekiyoruz (JOIN YOK)
    let query = supabase
      .from('records')
      .select('question_count, subject_id, topic_id, source_id, activity_date') // ID'leri çekiyoruz
      .eq('user_id', uid!) // Sadece kendi verisi
      .not('question_count', 'is', null)
      .gt('question_count', 0);

    // Filtreleri Uygula
    if (start) query = query.gte('activity_date', start);
    if (end) query = query.lte('activity_date', end);
    if (selectedSubject !== 'all') query = query.eq('subject_id', selectedSubject);
    if (selectedTopic !== 'all') query = query.eq('topic_id', selectedTopic);
    if (selectedSource !== 'all') query = query.eq('source_id', selectedSource);

    const { data: rawData, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // BİRLEŞTİRME (ID -> İsim)
    // Ham veriyi alıp, yukarıda oluşturduğumuz Map'lerden isimleri buluyoruz.
    const processedRows: StudentReportRow[] = (rawData as RawRecord[]).map(r => ({
      question_count: r.question_count,
      subject_name: (r.subject_id ? subjectsMap.get(r.subject_id) : null) || 'Belirtilmemiş Ders',
      topic_name: (r.topic_id ? topicsMap.get(r.topic_id) : null) || 'Belirtilmemiş Konu',
      source_name: (r.source_id ? sourcesMap.get(r.source_id) : null) || 'Belirtilmemiş Kaynak',
    }));

    setReportRows(processedRows);
    setLoading(false);
  }

  // 4. CSV DÖKÜM
  function handleExportCSV() {
    if (reportRows.length === 0) return alert('Veri yok.');
    let csvContent = "data:text/csv;charset=utf-8,Ders,Konu,Kaynak,Soru Sayısı\n";
    reportRows.forEach(row => {
      // İsimler artık string olduğu için doğrudan yazabiliriz
      const s = `"${row.subject_name.replace(/"/g, '""')}"`;
      const t = `"${row.topic_name.replace(/"/g, '""')}"`;
      const src = `"${row.source_name.replace(/"/g, '""')}"`;
      csvContent += `${s},${t},${src},${row.question_count}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `raporum.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  // 5. GRUPLAMA VE RENDER
  const groupedData = useMemo(() => {
    const subjectsMap: SubjectMap = new Map();
    let totalQuestions = 0;

    for (const row of reportRows) {
      const subjName = row.subject_name;
      const topName = row.topic_name;
      const srcName = row.source_name;
      const count = row.question_count;

      totalQuestions += count;

      if (!subjectsMap.has(subjName)) subjectsMap.set(subjName, { total: 0, topics: new Map() });
      const subjectEntry = subjectsMap.get(subjName)!; subjectEntry.total += count;

      if (!subjectEntry.topics.has(topName)) subjectEntry.topics.set(topName, { total: 0, sources: new Map() });
      const topicEntry = subjectEntry.topics.get(topName)!; topicEntry.total += count;

      const sourceEntry = topicEntry.sources.get(srcName) || 0;
      topicEntry.sources.set(srcName, sourceEntry + count);
    }

    return { subjectsMap, totalQuestions };
  }, [reportRows]);

  if (authLoading) return <div className="p-4">Yükleniyor...</div>;

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Çalışma Raporum</h1>

      {/* Filtre Paneli */}
      <div className="p-4 bg-white rounded-lg shadow-sm border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Ders</label>
            <select className="w-full border rounded p-2" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}>
              <option value="all">Tümü</option>
              {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Konu</label>
            <select className="w-full border rounded p-2" value={selectedTopic} onChange={e=>setSelectedTopic(e.target.value)} disabled={selectedSubject==='all'}>
              <option value="all">Tümü</option>
              {topics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Kaynak</label>
            <select className="w-full border rounded p-2" value={selectedSource} onChange={e=>setSelectedSource(e.target.value)} disabled={selectedSubject==='all'}>
              <option value="all">Tümü</option>
              {sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tarih Filtreleri */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Tarih</label>
            <select className="w-full border rounded p-2" value={dateRangePreset} onChange={e=>setDateRangePreset(e.target.value)}>
              <option value="today">Bugün</option><option value="yesterday">Dün</option><option value="week">Bu Hafta</option><option value="month">Bu Ay</option><option value="all">Tüm Zamanlar</option><option value="custom">Tarih Seç</option><option value="customRange">Aralık Seç</option>
            </select>
          </div>
          {dateRangePreset === 'custom' && <div><label className="block text-sm font-medium">Gün</label><input type="date" className="w-full border rounded p-2" value={customDate} onChange={e=>setCustomDate(e.target.value)}/></div>}
          {dateRangePreset === 'customRange' && <><div><label className="block text-sm font-medium">Başlangıç</label><input type="date" className="w-full border rounded p-2" value={customRange.start} onChange={e=>setCustomRange(p=>({...p,start:e.target.value}))}/></div><div><label className="block text-sm font-medium">Bitiş</label><input type="date" className="w-full border rounded p-2" value={customRange.end} onChange={e=>setCustomRange(p=>({...p,end:e.target.value}))}/></div></>}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <button onClick={handleExportCSV} disabled={reportRows.length===0} className="px-4 py-2 bg-gray-200 rounded">CSV İndir</button>
          <button onClick={handleFetchReport} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading?'...':'Rapor Getir'}</button>
        </div>
      </div>

      {/* Sonuç Tablosu */}
      <div className="rounded-lg border bg-white shadow-sm p-4 space-y-4">
        {loading ? <p>Yükleniyor...</p> : reportRows.length===0 ? <p className="text-gray-500">Kayıt yok.</p> :
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex justify-between bg-gray-50 p-2 rounded"><span>Toplam</span><span>{groupedData.totalQuestions} Soru</span></h2>
            {Array.from(groupedData.subjectsMap.entries()).map(([sbName, sbData]) => (
              <div key={sbName} className="border-t pt-2">
                <h3 className="text-lg font-semibold flex justify-between"><span>{sbName}</span><span>{sbData.total} Soru</span></h3>
                {Array.from(sbData.topics.entries()).map(([tpName, tpData]) => (
                  <div key={tpName} className="pl-4 pt-1">
                    <h4 className="italic flex justify-between text-gray-700"><span>- {tpName}</span><span>{tpData.total} Soru</span></h4>
                    <ul className="pl-6 text-sm text-gray-600">
                      {Array.from(tpData.sources.entries()).map(([srcName, srcTotal]) => (
                        <li key={srcName} className="flex justify-between hover:bg-gray-50 px-1 rounded"><span>-- {srcName}</span><span>{srcTotal} Soru</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        }
      </div>
    </main>
  );
}
