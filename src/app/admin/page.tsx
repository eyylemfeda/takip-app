'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Shield, BarChart2, BookText, Share2 } from 'lucide-react';

export default function AdminDashboardPage() {
  const { profile, loading } = useAuth(); // 1. Buradan 'profile' alınır
  const role = profile?.role; // 2. 'role' profilden çıkarılır

  // Yetki kontrolü
  if (loading) {
    return <main className="p-4"><p>Yükleniyor...</p></main>;
  }

  if (role !== 'admin' && role !== 'coach') {
    return <main className="p-4"><p>Erişim yetkiniz yok.</p></main>;
  }

  // Admin Dashboard'u
  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={32} />
        <h1 className="text-3xl font-bold">Admin Paneli</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Raporlar Kartı */}
        <Link
          href="/admin/reports"
          className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500"
        >
          <BarChart2 className="h-8 w-8 text-blue-600" />
          <h2 className="text-lg font-semibold">Öğrenci Raporları</h2>
          <p className="text-sm text-gray-600">
            Öğrencilerin çalışmalarını filtreleyin, gruplayın ve döküm alın.
          </p>
        </Link>

        {/* Ünite/Konu Kartı (Eski linkiniz [cite: 29, 41]) */}
        <Link
          href="/admin/topics"
          className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500"
        >
          <BookText className="h-8 w-8 text-green-600" />
          <h2 className="text-lg font-semibold">Ders ve Konu Yönetimi</h2>
          <p className="text-sm text-gray-600">
            Sistemdeki ders, ünite ve konu tanımlamalarını düzenleyin.
          </p>
        </Link>

        {/* Davetler Kartı (HeaderBar'da [cite: 31, 42] vardı) */}
        <Link
          href="/admin/invites"
          className="flex flex-col gap-2 rounded-lg border bg-white p-6 shadow-sm hover:border-blue-500"
        >
          <Share2 className="h-8 w-8 text-purple-600" />
          <h2 className="text-lg font-semibold">Davet Kodları</h2>
          <p className="text-sm text-gray-600">
          Yeni öğrenci veya koç davet kodları oluşturun ve yönetin.
        </p>
        {/* Hatalı satır silindi */}
      </Link>

        {/* Yeni modüller için buraya kart ekleyebilirsiniz */}

      </div>
    </main>
  );
}
