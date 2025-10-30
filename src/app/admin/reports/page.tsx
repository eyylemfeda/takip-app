'use client'; // Bu sayfa interaktif olacağı için (filtreler, butonlar)

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib//AuthContext'; // AuthContext'i oluşturduğunuz yolu kullanın

/* ========= Tipler ========= */
type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type ReportRow = {
  group_key: string;      // RPC'den gelen: Ders, Konu veya Kaynak adı
  total_questions: number; // RPC'den gelen: Toplam soru sayısı
};

/* ========= Tarih Yardımcıları (Ana sayfanızdan [cite: 78-79]) ========= */
function startOfWeekMonday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Pazartesi'yi haftanın başı yap
  d.setDate(d.getDate() + diff); return d;
}
function startOfMonth(): Date {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d;
}
function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD formatı
}

/* ============================================== */
/* ANA RAPOR SAYFASI BİLEŞENİ         */
/* ============================================== */
export default function AdminReportsPage() {
  // 1. OTURUM VE YETKİ KONTROLÜ
  const { uid, profile, loading: authLoading } = useAuth(); // 1. Buradan 'profile' alınır
  const role = profile?.role; // 2. 'role' profilden çıkarılır

  // 2. FİLTRE DURUMLARI (STATE)
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('all'); // 'all' veya öğrenci UUID'si
  const [dateRange, setDateRange] = useState('all'); // 'today', 'week', 'month', 'all'
  const [groupBy, setGroupBy] = useState('subject'); // 'subject', 'topic', 'source'

  // 3. RAPOR SONUÇLARI
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false); // Rapor verisi için
  const [error, setError] = useState<string | null>(null);

    // Sayfa yüklendiğinde SADECE Öğrenci listesini çek
    useEffect(() => {
      if (authLoading) return; // Oturum ve rol yüklenene kadar bekle
      if (!uid) return; // Giriş yapılmamışsa

      // 2. Yetki kontrolünü burada yap (artık 'role'ü biliyoruz)
      if (!['admin', 'coach'].includes(role ?? '')) {
        setError('Bu sayfaya erişim yetkiniz yok.');
        return;
      }

      // 3. (Eski 3.2) Filtre için tüm öğrencileri çek
      (async () => {
        const { data: studentList, error: studentsError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('role', ['student', 'coach'])
          .order('full_name');

        if (studentsError) {
          setError(studentsError.message);
        } else {
          setStudents(studentList ?? []);
        }
      })();

    // 4. 'role'ü bağımlılıklara ekle
    }, [uid, authLoading, role]);

  // "RAPOR GETİR" BUTONUNA BASILDIĞINDA
  async function handleFetchReport() {
    setError(null);
    setLoading(true);
    setReportData([]);

    // 1. Tarih filtrelerini hazırla
    let start_date_filter: string | null = null;
    let end_date_filter: string | null = null;

    if (dateRange === 'today') {
      start_date_filter = toISODate(startOfToday());
      end_date_filter = start_date_filter;
    } else if (dateRange === 'week') {
      start_date_filter = toISODate(startOfWeekMonday());
      end_date_filter = toISODate(new Date()); // Bugün
    } else if (dateRange === 'month') {
      start_date_filter = toISODate(startOfMonth());
      end_date_filter = toISODate(new Date()); // Bugün
    }

    // 2. RPC Fonksiyonunu çağır
    const { data, error } = await supabase.rpc('get_admin_report', {
      student_id_filter: selectedStudent === 'all' ? null : selectedStudent,
      start_date_filter: start_date_filter,
      end_date_filter: end_date_filter,
      group_by_filter: groupBy
    });

    if (error) {
      setError(error.message);
    } else {
      setReportData(data ?? []);
    }
    setLoading(false);
  }

  // "CSV DÖKÜM AL" BUTONUNA BASILDIĞINDA
  // (xlsx yerine güvenli CSV yöntemi)
  function handleExportCSV() {
    if (reportData.length === 0) return alert('Döküm alınacak veri yok.');

    let csvContent = "data:text/csv;charset=utf-8,";
    // Başlıklar
    csvContent += `Gruplama (${groupBy}),Toplam Soru\n`;

    // Satırlar
    reportData.forEach(row => {
      // CSV'de sorun çıkarabilecek tırnak ve virgülleri temizle
      const key = `"${row.group_key.replace(/"/g, '""')}"`;
      csvContent += `${key},${row.total_questions}\n`;
    });

    // İndirme işlemi
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `derstakibim_rapor.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ========= EKRAN ÇIKTISI (RENDER) ========= */

  // Oturum veya Yetki yükleniyor...
  if (authLoading || (!role && !error)) {
    return <main className="p-4"><p>Yükleniyor...</p></main>;
  }

  // Yetki Yok Hatası
  if (error && !role) {
    return <main className="p-4"><p className="text-red-600">{error}</p></main>;
  }

  // Yetki var, Rapor Sayfasını Göster
  return (
    // Sizin ana layout dosyanızdaki  max-w-4xl ve px-3 sm:p-4 ayarlarını
    // burada kullanmıyoruz, çünkü o ayarlar bu sayfanın dışında (layout'ta)
    // zaten uygulanıyor ve içeriği ortalıyor.
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Raporları</h1>

      {/* === FİLTRE KONTROL PANELİ === */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-white rounded-lg shadow-sm border">

        {/* 1. Öğrenci Filtresi */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Öğrenci</label>
          <select
            value={selectedStudent}
            onChange={e => setSelectedStudent(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">Tüm Öğrenciler</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>

        {/* 2. Tarih Filtresi */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Tarih Aralığı</label>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta (Pazartesi'den beri)</option>
            <option value="month">Bu Ay</option>
          </select>
        </div>

        {/* 3. Gruplama Filtresi */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Gruplama</label>
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="subject">Derse Göre</option>
            <option value="topic">Konuya Göre</option>
            <option value="source">Kaynağa Göre</option>
          </select>
        </div>

        {/* 4. Butonlar */}
        <div className="flex flex-col md:flex-row md:items-end gap-2">
          <button
            onClick={handleFetchReport}
            disabled={loading}
            className="w-full h-10 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Getiriliyor...' : 'Rapor Getir'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="w-full h-10 px-4 py-2 bg-gray-200 text-gray-800 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
          >
            Döküm Al (CSV)
          </button>
        </div>
      </div>

      {/* === RAPOR SONUÇ TABLOSU === */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-4 text-gray-600">Yükleniyor...</p>
        ) : error ? (
          <p className="p-4 text-red-600">{error}</p>
        ) : reportData.length === 0 ? (
          <p className="p-4 text-gray-600">Filtrelere uygun veri bulunamadı.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {/* Başlığı dinamik olarak ayarla */}
                  {groupBy === 'subject' ? 'Ders' : groupBy === 'topic' ? 'Konu' : 'Kaynak'}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Toplam Soru
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((row) => (
                <tr key={row.group_key}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.group_key || 'Belirtilmemiş'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.total_questions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
