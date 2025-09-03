import Link from 'next/link';

export default function ErrorPage({
  searchParams,
}: {
  searchParams?: { msg?: string };
}) {
  const msg = searchParams?.msg || 'Beklenmeyen bir hata oluştu.';
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-semibold">Doğrulama Başarısız</h1>
        <p className="mb-6 text-red-600">{msg}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Giriş Sayfasına Dön
        </Link>
      </div>
    </main>
  );
}
