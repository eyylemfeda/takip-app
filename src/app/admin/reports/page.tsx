'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

/* ========= Tipler ========= */
type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};
// Veritabanı seçimleri için genel tip
type SelectOption = { id: string; name: string };

// RPC'den gelen ham veri satırı
type ReportRow = {
  student_full_name: string | null;
  subject_name: string | null;
  topic_name: string | null;
  source_name: string | null;
  question_count: number;
};

// Hiyerarşik veri yapımız
type SourceMap = Map<string, number>;
type TopicMap = Map<string, { total: number; sources: SourceMap }>;
type SubjectMap = Map<string, { total: number; topics: TopicMap }>;
type StudentMap = Map<string, { total: number; subjects: SubjectMap }>;

/* ========= Tarih Yardımcıları ========= */
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
/* ANA RAPOR SAYFASI BİLEŞENİ         */
/* ============================================== */
export default function AdminReportsPage() {
  // 1. OTURUM VE YETKİ KONTROLÜ
  const { uid, profile, loading: authLoading } = useAuth(); // 1. Buradan 'profile' alınır
  const role = profile?.role; // 2. 'role' profilden çıkarılır

  // 2. FİLTRE VERİLERİ (Dropdown'ları doldurmak için)
  const [students, setStudents] = useState<Profile[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [topics, setTopics] = useState<SelectOption[]>([]); // Boş dizi olarak başla
  const [sources, setSources] = useState<SelectOption[]>([]); // Boş dizi olarak başla

  // 3. SEÇİLİ FİLTRELER
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  // Yeni Tarih Filtreleri
  const [dateRangePreset, setDateRangePreset] = useState('today'); // 'today', 'yesterday', 'week', 'month', 'all', 'custom', 'customRange'
  const [customDate, setCustomDate] = useState(toISODate(new Date()));
  const [customRange, setCustomRange] = useState({
    start: toISODate(new Date(new Date().setDate(1))),
    end: toISODate(new Date()),
  });

  // 4. RAPOR SONUÇLARI
  const [reportRows, setReportRows] = useState<ReportRow[]>([]); // RPC'den gelen ham veri
  const [loading, setLoading] = useState(false); // Rapor verisi için
  const [error, setError] = useState<string | null>(null);

  // Sayfa yüklendiğinde Yetki kontrolü + Filtre verilerini çek
  useEffect(() => {
    if (authLoading) return;
    if (!uid) return;

    if (!['admin', 'coach'].includes(role ?? '')) {
      setError('Bu sayfaya erişim yetkiniz yok.');
      return;
    }

    // Filtreler için verileri çek
    (async () => {
      // Öğrenciler
      supabase.from('profiles').select('id, full_name, role')
        .in('role', ['student', 'coach']).order('full_name')
        .then(({ data }) => setStudents(data ?? []));

      // Dersler
      supabase.from('subjects').select('id, name').order('name')
        .then(({ data }) => setSubjects(data ?? []));

    })();
  }, [uid, authLoading, role]);


  // === GÜNCELLENMİŞ KOD BLOĞU ===
  // Seçili Ders VEYA Seçili Öğrenci değiştiğinde Konu ve Kaynakları filtrele
  useEffect(() => {
    // "Tüm Dersler" seçilirse listeleri boşalt
    if (selectedSubject === 'all') {
      setTopics([]);
      setSources([]);
      setSelectedTopic('all');
      setSelectedSource('all');
      return;
    }

    // --- Konuları Çek ---
    // (Konuların öğrenciye özel olmadığını, derse özel olduğunu varsayıyoruz)
    supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', selectedSubject)
      .order('name')
      .then(({ data }) => setTopics(data ?? []));

    // --- Kaynakları Çek (DİNAMİK SORGULAMA) ---
    // 1. Temel sorguyu başlat (Derse göre filtrele)
    let sourcesQuery = supabase
      .from('sources')
      .select('id, name')
      .eq('subject_id', selectedSubject);

    // 2. YENİ KONTROL: Eğer "Tüm Öğrenciler" DEĞİL, spesifik bir öğrenci seçiliyse...
    if (selectedStudent !== 'all') {
      // Sorguya 'user_id' filtresini de ekle
      sourcesQuery = sourcesQuery.eq('user_id', selectedStudent);
    }

    // 3. Sorguyu çalıştır
    sourcesQuery.order('name').then(({ data }) => {
      setSources(data ?? []);
    });

  }, [selectedSubject, selectedStudent]); // Artık 'selectedStudent' değişikliğini de dinliyor
  // "RAPOR GETİR" BUTONUNA BASILDIĞINDA
  async function handleFetchReport() {
    setError(null);
    setLoading(true);
    setReportRows([]);

    // 1. Tarih filtrelerini hazırla
    let start_date_filter: string | null = null;
    let end_date_filter: string | null = null;

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
    // 'all' ise ikisi de null kalır

    // 2. YENİ RPC Fonksiyonunu çağır
    const { data, error } = await supabase.rpc('get_admin_report_rows', {
      student_id_filter: selectedStudent === 'all' ? null : selectedStudent,
      start_date_filter: start_date_filter,
      end_date_filter: end_date_filter,
      subject_id_filter: selectedSubject === 'all' ? null : selectedSubject,
      topic_id_filter: selectedTopic === 'all' ? null : selectedTopic,
      source_id_filter: selectedSource === 'all' ? null : selectedSource,
    });

    if (error) {
      setError(error.message);
    } else {
      setReportRows((data as ReportRow[]) ?? []);
    }
    setLoading(false);
  }

  // "CSV DÖKÜM AL" BUTONUNA BASILDIĞINDA
  function handleExportCSV() {
    if (reportRows.length === 0) return alert('Döküm alınacak veri yok.');

    let csvContent = "data:text/csv;charset=utf-8,";
    // Başlıklar
    csvContent += "Öğrenci,Ders,Konu,Kaynak,Soru Sayısı\n";

    // Satırlar
    reportRows.forEach(row => {
      const student = `"${(row.student_full_name ?? '').replace(/"/g, '""')}"`;
      const subject = `"${(row.subject_name ?? '').replace(/"/g, '""')}"`;
      const topic = `"${(row.topic_name ?? '').replace(/"/g, '""')}"`;
      const source = `"${(row.source_name ?? '').replace(/"/g, '""')}"`;
      csvContent += `${student},${subject},${topic},${source},${row.question_count}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `derstakibim_rapor_detayli.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 3. VERİYİ HİYERARŞİK YAPIYA DÖNÜŞTÜRME
  // Kullanıcının istediği karmaşık hiyerarşik listeleme
  const groupedData = useMemo(() => {
    const studentsMap: StudentMap = new Map();

    for (const row of reportRows) {
      const sName = row.student_full_name || 'Bilinmeyen Öğrenci';
      const subjName = row.subject_name || 'Belirtilmemiş Ders';
      const topName = row.topic_name || 'Belirtilmemiş Konu';
      const srcName = row.source_name || 'Belirtilmemiş Kaynak';
      const count = row.question_count || 0;

      // Öğrenci seviyesi
      if (!studentsMap.has(sName)) {
        studentsMap.set(sName, { total: 0, subjects: new Map() });
      }
      const studentEntry = studentsMap.get(sName)!;
      studentEntry.total += count;

      // Ders seviyesi
      if (!studentEntry.subjects.has(subjName)) {
        studentEntry.subjects.set(subjName, { total: 0, topics: new Map() });
      }
      const subjectEntry = studentEntry.subjects.get(subjName)!;
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

    // Zorunluluklara göre sıralama mantığını burada uygulayabiliriz
    // Ama şimdilik tam hiyerarşiyi döndürelim

    return studentsMap;
  }, [reportRows]);

  /* ========= EKRAN ÇIKTISI (RENDER) ========= */

  if (authLoading || (!role && !error)) {
    return <main className="p-4"><p>Yükleniyor...</p></main>;
  }
  if (error && !role) {
    return <main className="p-4"><p className="text-red-600">{error}</p></main>;
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Raporları (Detaylı)</h1>

      {/* === FİLTRE KONTROL PANELİ (YENİ) === */}
      <div className="p-4 bg-white rounded-lg shadow-sm border space-y-4">

        {/* Satır 1: Ana Filtreler */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 1. Öğrenci Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Öğrenci</label>
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            >
              <option value="all">Tüm Öğrenciler</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          {/* 2. Ders Filtresi */}
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

          {/* 3. Konu Filtresi */}
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

          {/* 4. Kaynak Filtresi */}
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

        {/* Satır 2: Tarih Filtreleri */}
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

        {/* Satır 3: Butonlar (Düzeltilmiş) */}
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

      {/* === RAPOR SONUÇ TABLOSU (HİYERARŞİK) === */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-600">Yükleniyor...</p>
        ) : error ? (
          <p className="p-4 text-red-600">{error}</p>
        ) : reportRows.length === 0 ? (
          <p className="p-4 text-gray-600">Filtrelere uygun veri bulunamadı.</p>
        ) : (
          <div className="p-4 space-y-4">
            {Array.from(groupedData.entries()).map(([studentName, studentData]) => (
              <div key={studentName} className="border-b-2 pb-2">
                <h2 className="text-xl font-bold flex justify-between">
                  <span>{studentName}</span>
                  <span>{studentData.total} Soru</span>
                </h2>

                {Array.from(studentData.subjects.entries()).map(([subjectName, subjectData]) => (
                  <div key={subjectName} className="pl-4 pt-2">
                    <h3 className="text-lg font-semibold flex justify-between">
                      <span>{subjectName}</span>
                      <span>{subjectData.total} Soru</span>
                    </h3>

                    {Array.from(subjectData.topics.entries()).map(([topicName, topicData]) => (
                      <div key={topicName} className="pl-8 pt-1">
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
