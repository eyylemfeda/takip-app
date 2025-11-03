'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

/* ========= Tipler ========= */
// Veritabanı seçimleri için genel tip
type SelectOption = { id: string; name: string };

// Veritabanından gelen ham veri satırı (records)
type StudentReportRow = {
  question_count: number;
  subjects: { name: string }[] | null; // <-- Köşeli parantez eklendi
  topics: { name: string }[] | null;   // <-- Köşeli parantez eklendi
  sources: { name: string }[] | null;  // <-- Köşeli parantez eklendi
};

// Hiyerarşik veri yapımız (Öğrenci seviyesi kaldırıldı)
type SourceMap = Map<string, number>;
type TopicMap = Map<string, { total: number; sources: SourceMap }>;
type SubjectMap = Map<string, { total: number; topics: TopicMap }>;

/* ========= Tarih Yardımcıları (Admin sayfasıyla aynı) ========= */
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD formatı
}

const DATES = {
  today: {
    start: toISODate(new Date(new Date().setHours(0, 0, 0, 0))),
    end: toISODate(new Date()),
  },
  yesterday: {
    start: toISODate(new Date(new Date().setDate(new Date().getDate() - 1))),
    end: toISODate(new Date(new Date().setDate(new Date().getDate() - 1))),
  },
  week: {
    start: (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day); // Pazartesi başı
      d.setDate(d.getDate() + diff); return toISODate(d);
    })(),
    end: toISODate(new Date()),
  },
  month: {
    start: toISODate(new Date(new Date().setDate(1))),
    end: toISODate(new Date()),
  },
};

/* ============================================== */
/* ÖĞRENCİ RAPOR SAYFASI BİLEŞENİ     */
/* ============================================== */
export default function StudentReportPage() {
  // 1. OTURUM KONTROLÜ
  const { uid, loading: authLoading } = useAuth(); // Sadece 'uid' yeterli

  // 2. FİLTRE VERİLERİ (Dropdown'ları doldurmak için)
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [topics, setTopics] = useState<SelectOption[]>([]); // Boş dizi olarak başla
  const [sources, setSources] = useState<SelectOption[]>([]); // Boş dizi olarak başla

  // 3. SEÇİLİ FİLTRELER (Öğrenci filtresi kaldırıldı)
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  const [dateRangePreset, setDateRangePreset] = useState('today');
  const [customDate, setCustomDate] = useState(toISODate(new Date()));
  const [customRange, setCustomRange] = useState({
    start: toISODate(new Date(new Date().setDate(1))),
    end: toISODate(new Date()),
  });

  // 4. RAPOR SONUÇLARI
  const [reportRows, setReportRows] = useState<StudentReportRow[]>([]); // RPC'den gelen ham veri
  const [loading, setLoading] = useState(false); // Rapor verisi için
  const [error, setError] = useState<string | null>(null);

  // Sayfa yüklendiğinde Filtre verilerini çek
  useEffect(() => {
    if (authLoading) return;
    if (!uid) return; // Giriş yapılmamışsa (AuthContext zaten yönlendirir)

    // Filtreler için verileri çek (Admin sayfasıyla aynı)
    (async () => {
      supabase.from('subjects').select('id, name').order('name')
        .then(({ data }) => setSubjects(data ?? []));
    })();
  }, [uid, authLoading]);

  // === YENİ KOD BLOĞU ===
  // Seçili Ders değiştiğinde Konu ve Kaynakları filtrele
  useEffect(() => {
    // "Tüm Dersler" seçilirse veya hiçbir şey seçilmezse listeleri boşalt
    if (selectedSubject === 'all') {
      setTopics([]);
      setSources([]);
      setSelectedTopic('all');
      setSelectedSource('all');
      return;
    }

    // Seçilen derse ait konuları çek
    supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', selectedSubject) // 'topics' tablosunda 'subject_id' olduğunu varsayıyoruz
      .order('name')
      .then(({ data }) => setTopics(data ?? []));

    // Seçilen derse ait kaynakları çek
    supabase
      .from('sources')
      .select('id, name')
      .eq('subject_id', selectedSubject) // 'sources' tablosunda 'subject_id' olduğunu biliyoruz
      .order('name')
      .then(({ data }) => setSources(data ?? []));

  }, [selectedSubject]); // Bu efekt "selectedSubject" her değiştiğinde çalışır

  // "RAPOR GETİR" BUTONUNA BASILDIĞINDA (GÜNCELLENDİ)
  async function handleFetchReport() {
    setError(null);
    setLoading(true);
    setReportRows([]);

    // 1. Tarih filtrelerini hazırla
    let start_date_filter: string | null = null;
    let end_date_filter: string | null = null;

    // (Tarih mantığı admin sayfasıyla aynı)
    if (dateRangePreset === 'today') {
      start_date_filter = DATES.today.start; end_date_filter = DATES.today.end;
    } else if (dateRangePreset === 'yesterday') {
      start_date_filter = DATES.yesterday.start; end_date_filter = DATES.yesterday.end;
    } else if (dateRangePreset === 'week') {
      start_date_filter = DATES.week.start; end_date_filter = DATES.week.end;
    } else if (dateRangePreset === 'month') {
      start_date_filter = DATES.month.start; end_date_filter = DATES.month.end;
    } else if (dateRangePreset === 'custom') {
      start_date_filter = customDate; end_date_filter = customDate;
    } else if (dateRangePreset === 'customRange') {
      start_date_filter = customRange.start; end_date_filter = customRange.end;
    }

    // 2. YENİ VERİ ÇEKME YÖNTEMİ (RPC DEĞİL)
    // RLS (records_read_own) sayesinde user_id'yi sormamıza gerek yok

    let query = supabase
      .from('records')
      .select(`
        question_count,
        subjects ( name ),
        topics ( name ),
        sources ( name )
      `)
      .not('question_count', 'is', null)
      .gt('question_count', 0);

    // Tarih filtrelerini ekle
    if (start_date_filter) {
      query = query.gte('activity_date', start_date_filter);
    }
    if (end_date_filter) {
      query = query.lte('activity_date', end_date_filter);
    }
    // Kademeli filtreleri ekle
    if (selectedSubject !== 'all') {
      query = query.eq('subject_id', selectedSubject);
    }
    if (selectedTopic !== 'all') {
      query = query.eq('topic_id', selectedTopic);
    }
    if (selectedSource !== 'all') {
      query = query.eq('source_id', selectedSource); // (source_id olduğunu varsayıyoruz)
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else {
      setReportRows((data as StudentReportRow[]) ?? []);
    }
    setLoading(false);
  }

  // "CSV DÖKÜM AL" BUTONUNA BASILDIĞINDA (GÜNCELLENDİ)
  function handleExportCSV() {
    if (reportRows.length === 0) return alert('Döküm alınacak veri yok.');

    let csvContent = "data:text/csv;charset=utf-8,";
    // Başlıklar (Öğrenci sütunu kaldırıldı)
    csvContent += "Ders,Konu,Kaynak,Soru Sayısı\n";

    // Satırlar
    reportRows.forEach(row => {
      // Dizi olduğu için ilk elemanın (?.\[0]) ismini (?.name) alıyoruz
      const subject = `"${(row.subjects?.[0]?.name ?? '').replace(/"/g, '""')}"`;
      const topic = `"${(row.topics?.[0]?.name ?? '').replace(/"/g, '""')}"`;
      const source = `"${(row.sources?.[0]?.name ?? '').replace(/"/g, '""')}"`;
      csvContent += `${subject},${topic},${source},${row.question_count}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `raporum.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 3. VERİYİ HİYERARŞİK YAPIYA DÖNÜŞTÜRME (GÜNCELLENDİ)
  const groupedData = useMemo(() => {
    // Öğrenci seviyesi kaldırıldı
    const subjectsMap: SubjectMap = new Map();
    let totalQuestions = 0;

    for (const row of reportRows) {
      // Dizi olduğu için ilk elemanın (?.\[0]) ismini (?.name) alıyoruz
      const subjName = row.subjects?.[0]?.name || 'Belirtilmemiş Ders';
      const topName = row.topics?.[0]?.name || 'Belirtilmemiş Konu';
      const srcName = row.sources?.[0]?.name || 'Belirtilmemiş Kaynak';
      const count = row.question_count || 0;

      totalQuestions += count;

      // Ders seviyesi
      if (!subjectsMap.has(subjName)) {
        subjectsMap.set(subjName, { total: 0, topics: new Map() });
      }
      const subjectEntry = subjectsMap.get(subjName)!;
      subjectEntry.total += count;

      // Konu seviyesi
      if (!subjectEntry.topics.has(topName)) {
        subjectEntry.topics.set(topName, { total: 0, sources: new Map() });
      }
      const topicEntry = subjectEntry.topics.get(topName)!;
      topicEntry.total += count;

      // Kaynak seviyesi
      const sourceEntry = topicEntry.sources.get(srcName) || 0;
      topicEntry.sources.set(srcName, sourceEntry + count);
    }

    return { subjectsMap, totalQuestions };
  }, [reportRows]);

  /* ========= EKRAN ÇIKTISI (RENDER) ========= */

  if (authLoading) {
    return <main className="p-4"><p>Yükleniyor...</p></main>;
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Çalışma Raporum</h1>

      {/* === FİLTRE KONTROL PANELİ (Öğrenci filtresi kaldırıldı) === */}
      <div className="p-4 bg-white rounded-lg shadow-sm border space-y-4">

        {/* Satır 1: Ana Filtreler (Grid 4'ten 3'e düşürüldü) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 1. Ders Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Ders</label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            >
              <option value="all">Tüm Dersler</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Konu Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Konu</label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              disabled={selectedSubject === 'all'} // Ders seçimi zorunlu
            >
              <option value="all">Tüm Konular</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Kaynak Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Kaynak</label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              disabled={selectedSubject === 'all'} // Ders seçimi zorunlu
            >
              <option value="all">Tüm Kaynaklar</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Satır 2: Tarih Filtreleri (Admin sayfasıyla aynı) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tarih Aralığı</label>
            <select
              value={dateRangePreset}
              onChange={e => setDateRangePreset(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            >
              <option value="today">Bugün</option>
              <option value="yesterday">Dün</option>
              <option value="week">Bu Hafta (Pzt'den beri)</option>
              <option value="month">Bu Ay</option>
              <option value="all">Tüm Zamanlar</option>
              <option value="custom">Belirli Bir Tarih</option>
              <option value="customRange">İki Tarih Arası</option>
            </select>
          </div>

          {/* Koşullu Takvimler */}
          {dateRangePreset === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Tarih Seç</label>
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              />
            </div>
          )}
          {dateRangePreset === 'customRange' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Başlangıç</label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bitiş</label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                />
              </div>
            </>
          )}
        </div>

        {/* Satır 3: Butonlar */}
        <div className="flex flex-col md:flex-row md:justify-end gap-3 pt-3 border-t">
          <button
            onClick={handleExportCSV}
            disabled={reportRows.length === 0}
            className="w-full md:w-auto h-10 px-4 py-2 bg-gray-200 text-gray-800 rounded-md shadow-sm hover:bg-gray-300 disabled:opacity-50"
          >
            Döküm Al (CSV)
          </button>
          <button
            onClick={handleFetchReport}
            disabled={loading}
            className="w-full md:w-auto h-10 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Getiriliyor...' : 'Rapor Getir'}
          </button>
        </div>
      </div>

      {/* === RAPOR SONUÇ TABLOSU (HİYERARŞİK - ÖĞRENCİSİZ) === */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-600">Yükleniyor...</p>
        ) : error ? (
          <p className="p-4 text-red-600">{error}</p>
        ) : reportRows.length === 0 ? (
          <p className="p-4 text-gray-600">Filtrelere uygun veri bulunamadı.</p>
        ) : (
          <div className="p-4 space-y-4">
            {/* Toplam Soru Başlığı */}
            <h2 className="text-xl font-bold flex justify-between">
              <span>Toplam Filtrelenen Soru</span>
              <span>{groupedData.totalQuestions} Soru</span>
            </h2>

            {Array.from(groupedData.subjectsMap.entries()).map(([subjectName, subjectData]) => (
              <div key={subjectName} className="border-t pt-2">
                <h3 className="text-lg font-semibold flex justify-between">
                  <span>{subjectName}</span>
                  <span>{subjectData.total} Soru</span>
                </h3>

                {Array.from(subjectData.topics.entries()).map(([topicName, topicData]) => (
                  <div key={topicName} className="pl-4 pt-1">
                    <h4 className="italic flex justify-between text-gray-700"> {/* */}
                      <span>— {topicName}</span> {/* */}
                      <span>{topicData.total} Soru</span>
                    </h4>

                    <ul className="pl-8 text-sm text-gray-600">
                      {Array.from(topicData.sources.entries()).map(([sourceName, sourceTotal]) => (
                        <li key={sourceName} className="flex justify-between">
                          <span>—— {sourceName}</span>
                          <span>{sourceTotal} Soru</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
