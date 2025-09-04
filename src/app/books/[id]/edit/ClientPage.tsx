"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from '@/lib/supabase/client';
import BookForm, { BookFormValues } from "@/components/BookForm";

const supabase = createClient();

// İstersen bu tipi '@/types' içinden import edebilirsin.
// Burada dosya içi tip olarak bırakıyorum.
type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_url: string | null;
  is_finished: boolean;
};

export default function ClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [book, setBook] = useState<BookRow | null>(null);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id ?? null;
      setUid(u);
      if (!u) return;

      const { data: r, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();

      if (error) setMsg(error.message);
      else setBook(r as BookRow);
    })();
  }, [params.id]);

  if (!uid) {
    return (
      <main className="p-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">
          Giriş yap
        </Link>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="p-6">
        <p>Yükleniyor…</p>
      </main>
    );
  }

  async function handleSubmit(values: BookFormValues) {
  setMsg(undefined);

  // TS daraltma: book null ise işlemi durdur
  if (!book) {
    setMsg("Kayıt bulunamadı.");
    return;
  }

  const { error } = await supabase
    .from("books")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", book.id); // Artık TS burada şikayet etmez

  if (error) setMsg("Güncellenemedi: " + error.message);
  else {
    router.push("/books");
    router.refresh();
  }
}

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kitap Düzenle</h1>
        <Link
          href="/books"
          className="rounded-lg border px-3 py-2 hover:bg-gray-50"
        >
          Listeye dön
        </Link>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <BookForm
        uid={uid}
        initial={{
          title: book.title,
          author: book.author,
          total_pages: book.total_pages,
          cover_url: book.cover_url,
          is_finished: book.is_finished,
        }}
        onSubmit={handleSubmit}
        onCancel={() => history.back()}
        submitText="Güncelle"
      />
    </main>
  );
}
