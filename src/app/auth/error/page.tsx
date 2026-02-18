'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// 1. URL'den hatayı okuyan parça (Dinamik Kısım)
function ErrorContent() {
  const searchParams = useSearchParams();
  // URL'deki ?msg=... kısmını güvenli şekilde okur
  const msg = searchParams.get('msg') || 'Beklenmeyen bir hata oluştu.';

  return <p className="mb-6 text-red-600">{msg}</p>;
}

// 2. Sayfanın İskeleti (Statik Kısım)
export default function ErrorPage() {
  return (
    <main className="mx-auto max-w-md p-6 flex min-h-screen items-center justify-center">
      <div className="w-full rounded-2xl border bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-semibold text-gray-800">Doğrulama Başarısız</h1>
        
        {/* Kritik Nokta: Dinamik kısmı Suspense içine aldık */}
        <Suspense fallback={<p className="text-gray-400 mb-6">Hata detayı yükleniyor...</p>}>
          <ErrorContent />
        </Suspense>

        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-700 transition-colors font-medium"
        >
          Giriş Sayfasına Dön
        </Link>
      </div>
    </main>
  );
}