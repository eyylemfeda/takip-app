import Link from 'next/link';

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-semibold">Kayıt ve doğrulama tamamlandı ✅</h1>
        <p className="mb-6 text-gray-600">
          Artık hesabınla giriş yapıldı. Panele geçebilirsin.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Panele Git
        </Link>
      </div>
    </main>
  );
}
