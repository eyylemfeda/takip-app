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
  UserCheck
} from 'lucide-react';
// Sizin paylaştığınız gelişmiş kart bileşeni
import AdminStudentCard from '@/components/AdminStudentCard';

export default function AdminDashboardPage() {
  const { profile, loading } = useAuth();
  const [myStudents, setMyStudents] = useState<{ id: string; full_name: string }[]>([]);
  const role = profile?.role;

  // Öğrencileri Çek
  useEffect(() => {
    // Eğer profil henüz yüklenmediyse işlem yapma
    if (!profile) return;

    async function fetchStudents() {
      // TypeScript için profilin null olmadığından emin oluyoruz
      if (!profile) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        // BURADA DEĞİŞİKLİK YAPTIK: (profile as any).id
        // Bu sayede 'id yok' ve 'null olabilir' hatalarını susturuyoruz.
        .eq('coach_id', (profile as any).id)
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

      {/* --- 1. ÖĞRENCİ TAKİP BÖLÜMÜ (Kartlar) --- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <BarChart2 className="text-indigo-600" />
          <h2 className="text-xl font-semibold">Öğrencilerim & Performans</h2>
        </div>

        {myStudents.length > 0 ? (
          // AdminStudentCard bileşeni sabit yükseklikli olduğu için grid yapısı kuruyoruz
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {myStudents.map((student) => (
              <AdminStudentCard
                key={student.id}
                studentId={student.id}
                studentName={student.full_name || 'İsimsiz Öğrenci'}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Size atanmış öğrenci bulunmuyor.</p>
            {isAdmin && (
              <p className="text-sm text-gray-400 mt-1">
                "Kullanıcı Yönetimi" sayfasından öğrencilere koç ataması yapabilirsiniz.
              </p>
            )}
          </div>
        )}
      </section>

      {/* --- 2. HIZLI ERİŞİM & YÖNETİM --- */}
      <section className="space-y-4 pt-4 border-t">
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
                <p className="text-xs text-gray-500 mt-1">Koç atamaları, rol değişiklikleri ve kullanıcı listesi.</p>
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
                <p className="text-xs text-gray-500 mt-1">Dersler, konular ve üniteleri düzenleyin.</p>
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
              <p className="text-xs text-gray-500 mt-1">
                {isAdmin ? 'Yeni kullanıcı davetleri oluşturun.' : 'Öğrencilerinize davet kodu gönderin.'}
              </p>
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
    </main>
  );
}
