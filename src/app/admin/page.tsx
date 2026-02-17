'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  Shield,
  BarChart2,
  BookText,
  Share2,
  Users,
  LayoutDashboard,
  Settings,
  UserPlus,
  UserCheck,
  Search,
  X,
  PlusCircle,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import AdminStudentCard from '@/components/AdminStudentCard';

// --- TİP TANIMLARI ---
type Student = {
  id: string;
  full_name: string;
  coach_id: string | null;
};

export default function AdminDashboardPage() {
  // ARTIK 'uid' DEĞERİNİ DOĞRUDAN ALIYORUZ (KESİN KİMLİK)
  const { profile, uid, loading } = useAuth();

  const [myStudents, setMyStudents] = useState<Student[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [candidateStudents, setCandidateStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const role = profile?.role;

  // --- 1. Kendi Öğrencilerimi Getir ---
  async function fetchMyStudents() {
    if (!uid) return; // UID yoksa işlem yapma

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, coach_id')
      .eq('role', 'student')
      .eq('coach_id', uid) // ARTIK 'uid' KULLANIYORUZ
      .order('full_name');

    if (data) setMyStudents(data);
  }

  useEffect(() => {
    fetchMyStudents();
  }, [uid]); // UID değişince çalış

  // --- 2. Tüm Öğrencileri Getir (Modal İçin) ---
  async function fetchAllStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, coach_id')
      .eq('role', 'student')
      .order('full_name');

    if (data) setCandidateStudents(data);
  }

  useEffect(() => {
    if (isAddModalOpen) {
      fetchAllStudents();
    }
  }, [isAddModalOpen]);

  // --- 3. Öğrenciyi Listeme Ekle (Koç Atama) ---
  async function addStudentToMyList(studentId: string) {
    if (!uid) return;
    setAddingId(studentId);

    // 1. Veritabanında güncelle (Beni koç yap)
    const { error } = await supabase
        .from('profiles')
        .update({ coach_id: uid }) // Kendi ID'mizi basıyoruz
        .eq('id', studentId);

    if (error) {
        alert('Hata: ' + error.message);
    } else {
        // 2. Listeleri güncelle
        await fetchMyStudents();
        await fetchAllStudents();
    }
    setAddingId(null);
  }

  // --- 4. Öğrenciyi Listemden Çıkar ---
  async function removeStudentFromList(studentId: string) {
    if (!confirm('Bu öğrenciyi listenizden çıkarmak istediğinize emin misiniz?')) return;

    const { error } = await supabase
        .from('profiles')
        .update({ coach_id: null })
        .eq('id', studentId);

    if (!error) {
        await fetchMyStudents();
        await fetchAllStudents();
    }
  }

  // Yetki Kontrolü
  if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  if (role !== 'admin' && role !== 'coach') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Erişim Yetkiniz Yok</h1>
        <Link href="/" className="text-blue-600 hover:underline">Anasayfaya Dön</Link>
      </div>
    );
  }

  const isAdmin = role === 'admin';

  // Modal Filtreleme
  const filteredCandidates = candidateStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="space-y-8 pb-12 relative">

      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Shield size={36} className="text-indigo-900" />
          ) : (
            <LayoutDashboard size={36} className="text-emerald-700" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {isAdmin ? 'Yönetim Paneli' : 'Koç Paneli'}
            </h1>
            <p className="text-gray-500 text-sm">
              Hoş geldin, <span className="font-semibold text-gray-700">{profile?.full_name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 1. YÖNETİM ARAÇLARI */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Yönetim Araçları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isAdmin && (
            <Link href="/admin/users" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg w-fit group-hover:scale-110 transition-transform"><Users size={24} /></div>
              <div><h3 className="font-bold text-gray-800">Kullanıcı Yönetimi</h3><p className="text-xs text-gray-500 mt-1">Koç atamaları ve rol işlemleri.</p></div>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin/topics" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg w-fit group-hover:scale-110 transition-transform"><BookText size={24} /></div>
              <div><h3 className="font-bold text-gray-800">Müfredat Yönetimi</h3><p className="text-xs text-gray-500 mt-1">Ders ve konu düzenlemeleri.</p></div>
            </Link>
          )}
          <Link href="/admin/invites" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-purple-500 hover:shadow-md transition-all">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg w-fit group-hover:scale-110 transition-transform"><Share2 size={24} /></div>
            <div><h3 className="font-bold text-gray-800">Davet Kodları</h3><p className="text-xs text-gray-500 mt-1">Sisteme yeni öğrenci kaydet.</p></div>
          </Link>
          <Link href="/admin/reports" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg w-fit group-hover:scale-110 transition-transform"><Settings size={24} /></div>
            <div><h3 className="font-bold text-gray-800">Genel Raporlar</h3><p className="text-xs text-gray-500 mt-1">Detaylı analizler ve kayıtlar.</p></div>
          </Link>
        </div>
      </section>

      {/* 2. ÖĞRENCİLER VE PERFORMANS */}
      <section className="space-y-4 pt-6 border-t">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
                <BarChart2 className="text-indigo-600" />
                <h2 className="text-xl font-semibold">Öğrencilerim & Performans</h2>
            </div>

            {/* ÖĞRENCİ EKLE BUTONU */}
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
                <PlusCircle size={18} />
                <span className="hidden sm:inline">Öğrenci Ekle</span>
                <span className="sm:hidden">Ekle</span>
            </button>
        </div>

        {myStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {myStudents.map((student) => (
              <div key={student.id} className="relative group/card">
                  {/* Kart Bileşeni */}
                  <AdminStudentCard
                    studentId={student.id}
                    studentName={student.full_name || 'İsimsiz Öğrenci'}
                  />

                  {/* Listeden Çıkarma Butonu (Sağ üstte gizli, hoverla görünür) */}
                  <button
                    onClick={() => removeStudentFromList(student.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-200"
                    title="Listemden Çıkar"
                  >
                    <X size={14} />
                  </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Henüz Listenizde Öğrenci Yok</h3>
            <p className="text-gray-500 mt-1 mb-4">Sağ üstteki "Öğrenci Ekle" butonunu kullanarak mevcut öğrencileri listenize alın.</p>
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:underline"
            >
                <UserPlus size={18} />
                Listeye Öğrenci Ekle
            </button>
          </div>
        )}
      </section>

      {/* === MODAL: ÖĞRENCİ SEÇİMİ === */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">

            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">Öğrenci Seç ve Ekle</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="İsim ile ara..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Modal List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Öğrenci bulunamadı.</div>
              ) : (
                filteredCandidates.map(student => {
                  // KİMLİK KONTROLÜ BURADA GÜNCELLENDİ (UID KULLANILIYOR)
                  const isAlreadyMine = student.coach_id === uid;
                  const hasOtherCoach = student.coach_id && !isAlreadyMine;

                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                      <div>
                        <div className="font-semibold text-gray-800">{student.full_name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                           {isAlreadyMine && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 size={12}/> Listenizde</span>}
                           {hasOtherCoach && <span className="text-orange-500 flex items-center gap-0.5"><AlertCircle size={12}/> Başka koçu var</span>}
                           {!student.coach_id && <span>Koçu yok</span>}
                        </div>
                      </div>

                      {isAlreadyMine ? (
                        <button
                            onClick={() => removeStudentFromList(student.id)}
                            className="text-gray-400 hover:text-red-600 p-2"
                            title="Listeden Çıkar"
                        >
                            <X size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => addStudentToMyList(student.id)}
                          disabled={addingId === student.id}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors
                            ${hasOtherCoach
                                ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }
                          `}
                        >
                          {addingId === student.id ? <Loader2 className="animate-spin" size={14}/> : <PlusCircle size={14}/>}
                          {hasOtherCoach ? 'Devral' : 'Ekle'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-gray-50 text-xs text-gray-500 text-center border-t">
              "Ekle" veya "Devral" dediğinizde öğrenci listenize atanır.
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
