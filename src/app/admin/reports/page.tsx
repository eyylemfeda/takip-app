{/*
'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';

type Profile = { id: string; full_name: string | null };
type RecordRow = {
  id: string;
  question_count: number;
  created_at: string;
  subjects: { name: string }[];  // 👈 dizi olarak
  topics: { name: string }[];
  sources: { name: string }[];
};


export default function AdminReportsPage() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Öğrencileri yükle
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (!error) setStudents(data ?? []);
    })();
  }, []);

  // Kayıtları getir
  async function fetchRecords() {
    if (!selectedStudent) return alert('Öğrenci seçiniz.');
    setLoading(true);
    const { data, error } = await supabase
      .from('records')
      .select(
        'id, question_count, created_at, subjects(name), topics(name), sources(name)'
      )
      .eq('user_id', selectedStudent)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    setRecords(data ?? []);
    setLoading(false);
  }

  // Ders → Konu → Kaynak bazlı gruplama
  const grouped = useMemo(() => {
    const structure: Record<
      string,
      Record<string, Record<string, number>>
    > = {};

    records.forEach((r) => {
      const ders = r.subjects?.[0]?.name || 'Belirtilmemiş';
      const konu = r.topics?.[0]?.name || 'Belirtilmemiş';
      const kaynak = r.sources?.[0]?.name || 'Belirtilmemiş';
      if (!structure[ders]) structure[ders] = {};
      if (!structure[ders][konu]) structure[ders][konu] = {};
      if (!structure[ders][konu][kaynak]) structure[ders][konu][kaynak] = 0;
      structure[ders][konu][kaynak] += r.question_count;
    });

    const sortedSubjects = Object.keys(structure).sort();
    return sortedSubjects.map((ders) => ({
      ders,
      konular: Object.keys(structure[ders])
        .sort()
        .map((konu) => ({
          konu,
          kaynaklar: Object.keys(structure[ders][konu])
            .sort()
            .map((kaynak) => ({
              kaynak,
              toplam: structure[ders][konu][kaynak],
            })),
        })),
    }));
  }, [records]);

  // Excel aktarımı
  function exportToExcel() {
    if (!records.length) return alert('Veri yok');

    const rows: any[] = [];
    grouped.forEach((ders) => {
      ders.konular.forEach((konu) => {
        konu.kaynaklar.forEach((k) => {
          rows.push({
            Ders: ders.ders,
            Konu: konu.konu,
            Kaynak: k.kaynak,
            'Soru Sayısı': k.toplam,
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
    XLSX.writeFile(wb, 'ogrenci_raporu.xlsx');
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Öğrenci Raporları</h1>

      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Öğrenci seç</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>

        <button
          onClick={fetchRecords}
          className="rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
        >
          Getir
        </button>

        <button
          onClick={exportToExcel}
          disabled={!records.length}
          className="rounded border px-4 py-2 hover:bg-gray-50"
        >
          Excel’e Aktar
        </button>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : !records.length ? (
        <p>Veri bulunamadı.</p>
      ) : (
        grouped.map((ders) => (
          <div
            key={ders.ders}
            className="border rounded-lg p-3 bg-white shadow-sm"
          >
            <h2 className="font-semibold text-lg mb-2">{ders.ders}</h2>
            {ders.konular.map((konu) => (
              <div key={konu.konu} className="ml-4 mb-2">
                <h3 className="font-medium">{konu.konu}</h3>
                <table className="w-full text-sm ml-4">
                  <tbody>
                    {konu.kaynaklar.map((k) => (
                      <tr key={k.kaynak} className="border-b last:border-0">
                        <td>{k.kaynak}</td>
                        <td className="text-right">{k.toplam}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))
      )}
    </main>
  );
}
*/}
