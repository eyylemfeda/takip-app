'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext'; // 1. YENİ: "Tek Kaptan" modeline geçiş

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
// Filtre dropdown'ları için
type SelectOption = { id: string; name: string };

/* ========= Yardımcılar (Değişmedi) [cite: 251-254] ========= */
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
  // 2. YENİ: Auth kancası güncellendi
  const { uid, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<RecordRow[]>([]); // [cite: 255]
  const [busy, setBusy] = useState(true); // [cite: 255]
  const [msg, setMsg] = useState<string>(); // [cite: 255]

  // === YENİ FİLTRE STATE'LERİ ===
  const [subjectsList, setSubjectsList] = useState<SelectOption[]>([]);
  const [topicsList, setTopicsList] = useState<SelectOption[]>([]);
  const [sourcesList, setSourcesList] = useState<SelectOption[]>([]);

  // Varsayılan olarak "Tüm Dersler"
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  // 3. GÜNCELLENDİ: Ana useEffect artık FİLTRELERİ de dinliyor
  // uid hazır olduğunda VEYA filtreler değiştiğinde listeyi çek
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return; // Oturum bekleniyor
      setBusy(true);
      setMsg(undefined);

      // Temel sorgu [cite: 257]
      let query = supabase
        .from('records')
        .select(`
          id, activity_date, off_calendar,
          question_count, duration_min, note,
          subject:subjects(id,name),
          topic:topics(id,name),
          source:sources(id,name)
        `)
        .eq('user_id', uid) // Sadece bu öğrencinin
        .order('activity_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      // === YENİ: Dinamik Filtreleri  Sorguya Ekle ===
      if (selectedSubject !== 'all') {
        query = query.eq('subject_id', selectedSubject);
      }
      if (selectedTopic !== 'all') {
        query = query.eq('topic_id', selectedTopic);
      }
      if (selectedSource !== 'all') {
        // 'source_id' olduğunu varsayıyoruz (admin rapor sayfasından teyitli)
        query = query.eq('source_id', selectedSource);
      }

      const { data: recs, error } = await query; // Sorguyu çalıştır

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
  }, [uid, selectedSubject, selectedTopic, selectedSource]); // Bağımlılıklar güncellendi

  // 4. YENİ: Kademeli filtreler  için 'useEffect'ler

  // 4a: Sayfa yüklendiğinde SADECE Ders listesini çek
  useEffect(() => {
    if (!uid) return;
    supabase
      .from('subjects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setSubjectsList(data ?? []));
  }, [uid]);

  // 4b: Ders seçildiğinde Konu ve Kaynakları  çek
  useEffect(() => {
    // "Tüm Dersler" seçilirse veya uid yoksa listeleri boşalt
    if (!uid || selectedSubject === 'all') {
      setTopicsList([]);
      setSourcesList([]);
      setSelectedTopic('all');
      setSelectedSource('all');
      return;
    }

    // Seçilen derse  ait konuları çek
    supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', selectedSubject)
      .order('name')
      .then(({ data }) => setTopicsList(data ?? []));

    // Seçilen derse  ve bu kullanıcıya ait kaynakları  çek
    supabase
      .from('sources')
      .select('id, name')
      .eq('user_id', uid)
      .eq('subject_id', selectedSubject)
      .order('name')
      .then(({ data }) => setSourcesList(data ?? []));

  }, [selectedSubject, uid]); // selectedSubject veya uid değiştiğinde çalışır

  // 5. GÜNCELLENDİ: Auth yüklemesini bekle
  // İlk anda (hook kontrol yaparken)
  if (authLoading) { // 'loading' [cite: 254] -> 'authLoading'
    return (
      <main className="px-2 py-5">
        <p className="text-sm text-gray-600">Yükleniyor…</p>
      </main>
    );
  }

  // uid yoksa render etmiyoruz (AuthContext zaten /login'e attı)
  if (!uid) return null; // [cite: 260]

  return (
    <main className="mx-auto max-w-none sm:max-w-3xl px-2 sm:px-4 md:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
      {/* Üst bar (Değişmedi) [cite: 261-263] */}
      <div className="mb-3 sm:mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Çalışma Kayıtlarım</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/records/new"
            className="inline-flex items-center justify-center h-7 w-24 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 md:h-auto md:w-auto md:px-4 md:py-2 md:text-sm"
          >
            Yeni Kayıt
          </Link>
        </div>
      </div>

      {/* === YENİ FİLTRE PANELİ === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-white rounded-lg shadow-sm border">
        {/* 1. Ders Filtresi  */}
        <div>
          <label htmlFor="filter-subject" className="block text-sm font-medium text-gray-700">Ders</label>
          <select
            id="filter-subject"
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          >
            <option value="all">Tüm Dersler</option>
            {subjectsList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* 2. Konu Filtresi  */}
        <div>
          <label htmlFor="filter-topic" className="block text-sm font-medium text-gray-700">Konu</label>
          <select
            id="filter-topic"
            value={selectedTopic}
            onChange={e => setSelectedTopic(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm disabled:bg-gray-100"
            disabled={selectedSubject === 'all'} // Ders seçilmeden görünmez
          >
            <option value="all">Tüm Konular</option>
            {topicsList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Kaynak Filtresi  */}
        <div>
          <label htmlFor="filter-source" className="block text-sm font-medium text-gray-700">Kaynak</label>
          <select
            id="filter-source"
            value={selectedSource}
            onChange={e => setSelectedSource(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm disabled:bg-gray-100"
            disabled={selectedSubject === 'all'} // Ders seçilmeden görünmez
          >
            <option value="all">Tüm Kaynaklar</option>
            {sourcesList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      {/* === FİLTRE PANELİ BİTİŞİ === */}


      {/* Hata/mesaj (Değişmedi) [cite: 263] */}
      {msg && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      {/* Liste (Arayüzü değişmedi, sadece 'rows' artık filtrelenmiş geliyor) [cite: 264-280] */}
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
                {/* İçerik tamamen aynı kaldı [cite: 266-280].
                  Fontlar, butonlar vb. korundu.
                */}
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
