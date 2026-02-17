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
  UserCheck
} from 'lucide-react';

// Sizin onayladığınız detaylı kart bileşeni
import AdminStudentCard from '@/components/AdminStudentCard';

export default function AdminDashboardPage() {
  const { profile, loading } = useAuth();
  const [myStudents, setMyStudents] = useState<{ id: string; full_name: string }[]>([]);
  const role = profile?.role;

  // Öğrencileri Çek
  useEffect(() => {
    if (!profile) return;

    async function fetchStudents() {
      // "Bana atanmış" öğrencileri bul (coach_id = benim id)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .eq('coach_id', (profile as any).id) // ID hatasını önlemek için cast ettik
        .order('full_name');

      if (data) {
        setMyStudents(data);
      }
    }

    fetchStudents();
  }, [profile]);

  if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  // Yetkisiz giriş koruması
  if (role !== 'admin' && role !== 'coach') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Erişim Yetkiniz Yok</h1>
        <Link href="/" className="text-blue-600 hover:underline">Anasayfaya Dön</Link>
      </div>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <main className="space-y-8 pb-12">

      {/* --- BAŞLIK --- */}
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

      {/* ========================================================= */}
      {/* 1. BÖLÜM: YÖNETİM ARAÇLARI (ÜSTTE)                       */}
      {/* ========================================================= */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Yönetim Araçları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

          {/* SADECE ADMIN GÖRÜR: Kullanıcı Yönetimi */}
          {isAdmin && (
            <Link href="/admin/users" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg w-fit group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Kullanıcı Yönetimi</h3>
                <p className="text-xs text-gray-500 mt-1">Koç atamaları ve rol işlemleri.</p>
              </div>
            </Link>
          )}

          {/* SADECE ADMIN GÖRÜR: Müfredat */}
          {isAdmin && (
            <Link href="/admin/topics" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg w-fit group-hover:scale-110 transition-transform">
                <BookText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Müfredat Yönetimi</h3>
                <p className="text-xs text-gray-500 mt-1">Ders ve konu düzenlemeleri.</p>
              </div>
            </Link>
          )}

          {/* HERKES GÖRÜR: Davet Kodları */}
          <Link href="/admin/invites" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-purple-500 hover:shadow-md transition-all">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg w-fit group-hover:scale-110 transition-transform">
              <Share2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Davet Kodları</h3>
              <p className="text-xs text-gray-500 mt-1">Yeni öğrenci eklemek için davet oluşturun.</p>
            </div>
          </Link>

          {/* HERKES GÖRÜR: Raporlar */}
          <Link href="/admin/reports" className="group flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg w-fit group-hover:scale-110 transition-transform">
              <Settings size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Genel Raporlar</h3>
              <p className="text-xs text-gray-500 mt-1">Detaylı analizler ve tüm kayıtlar.</p>
            </div>
          </Link>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. BÖLÜM: ÖĞRENCİLER VE PERFORMANS (ALTTA)               */}
      {/* ========================================================= */}
      <section className="space-y-4 pt-6 border-t">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
                <BarChart2 className="text-indigo-600" />
                <h2 className="text-xl font-semibold">Öğrencilerim & Performans</h2>
            </div>

            {/* ÖĞRENCİ EKLE BUTONU (Davet sayfasına yönlendirir) */}
            <Link
                href="/admin/invites"
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Öğrenci Ekle</span>
                <span className="sm:hidden">Ekle</span>
            </Link>
        </div>

        {myStudents.length > 0 ? (
          /* GRID YAPISI:
             - Mobil (default): grid-cols-1 (Her satırda 1 öğrenci)
             - Tablet/Masaüstü (md): grid-cols-2 (Her satırda 2 öğrenci - %50)
             - Geniş Ekran (xl): grid-cols-3 (Her satırda 3 öğrenci - %33)
             - gap-6: Kartlar arası boşluk
          */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {myStudents.map((student) => (
              <div key={student.id} className="min-w-0">
                  <AdminStudentCard
                    studentId={student.id}
                    studentName={student.full_name || 'İsimsiz Öğrenci'}
                  />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Henüz Öğrenciniz Yok</h3>
            <p className="text-gray-500 mt-1 mb-4">Takip etmek istediğiniz öğrencileri sisteme ekleyin.</p>
            <Link
                href="/admin/invites"
                className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:underline"
            >
                <UserPlus size={18} />
                İlk Öğrencini Davet Et
            </Link>
          </div>
        )}
      </section>

    </main>
  );
}
