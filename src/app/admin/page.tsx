'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Shield, BarChart2, BookText, Share2, Users, Settings } from 'lucide-react';
import AdminStudentCard from '@/components/AdminStudentCard';

// BURAYA ÇOCUKLARINIZIN UUID'LERİNİ YAZIN (Tırnak içine)
const KIZIM_ID = "19c3436b-0fb2-4c03-ae7c-6c94e1df5a79";
const OGLUM_ID = "5ef38af6-38d2-400d-91f3-2c79f5490958";

export default function AdminDashboardPage() {
  const { profile, loading } = useAuth();
  const role = profile?.role;

  if (loading) return <main className="p-4"><p>Yükleniyor...</p></main>;
  if (role !== 'admin' && role !== 'coach') return <main className="p-4"><p>Erişim yetkiniz yok.</p></main>;

  return (
    <main className="space-y-8">

      {/* BAŞLIK */}
      <div className="flex items-center gap-3">
        <Shield size={32} className="text-blue-900" />
        <h1 className="text-3xl font-bold text-gray-800">Admin Komuta Merkezi</h1>
      </div>

      {/* 1. ÖZEL TAKİP BÖLÜMÜ (SADECE ADMİN GÖRSÜN) */}
      {role === 'admin' && (
        <section className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BarChart2 size={20} />
                Özel Takip Paneli
            </h2>
            {/* Yatay Düzen: Solda Kızım, Sağda Oğlum */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64">
                <AdminStudentCard studentId={KIZIM_ID} studentName="Nisan Dua" />
                <AdminStudentCard studentId={OGLUM_ID} studentName="Toprak" />
            </div>
        </section>
      )}

      {/* 2. YÖNETİM KARTLARI */}
      <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Yönetim Araçları</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* KULLANICILAR (YENİ) */}
            <Link href="/admin/users" className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group">
              <Users className="h-8 w-8 text-indigo-600 group-hover:scale-110 transition-transform" />
              <h2 className="text-lg font-semibold">Kullanıcı Yönetimi</h2>
              <p className="text-sm text-gray-600">
                Öğrenci, Koç ve Adminleri listeleyin. Koç atamalarını yapın.
              </p>
            </Link>

            {/* Raporlar */}
            <Link href="/admin/reports" className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
              <BarChart2 className="h-8 w-8 text-blue-600" />
              <h2 className="text-lg font-semibold">Genel Raporlar</h2>
              <p className="text-sm text-gray-600">Öğrencilerin çalışmalarını filtreleyin ve döküm alın.</p>
            </Link>

            {/* Ders/Konu */}
            <Link href="/admin/topics" className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
              <BookText className="h-8 w-8 text-green-600" />
              <h2 className="text-lg font-semibold">Müfredat Yönetimi</h2>
              <p className="text-sm text-gray-600">Ders, ünite ve konuları düzenleyin.</p>
            </Link>

            {/* Davet Kodları */}
            <Link href="/admin/invites" className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
              <Share2 className="h-8 w-8 text-purple-600" />
              <h2 className="text-lg font-semibold">Davet Kodları</h2>
              <p className="text-sm text-gray-600">Yeni kullanıcı davetleri oluşturun.</p>
            </Link>
          </div>
      </section>
    </main>
  );
}
