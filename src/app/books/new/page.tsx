'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BookForm, { BookFormValues } from '@/components/BookForm';

export default function BookCreatePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id ?? null));
  }, []);

  if (!uid) {
    return (
      <main className="p-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">Giriş yap</Link>
      </main>
    );
  }

  async function handleSubmit(values: BookFormValues) {
    setMsg(undefined);
    const payload = {
      user_id: uid,
      ...values,
    };
    const { error } = await supabase.from('books').insert(payload);
    if (error) setMsg('Kayıt eklenemedi: ' + error.message);
    else {
      router.push('/books');
      router.refresh();
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kitap Ekle</h1>
        <Link href="/books" className="rounded-lg border px-3 py-2 hover:bg-gray-50">Listeye dön</Link>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <BookForm uid={uid} onSubmit={handleSubmit} />
    </main>
  );
}
