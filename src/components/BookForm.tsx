'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type BookFormValues = {
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_url: string | null;
  is_finished: boolean;
};

export default function BookForm({
  uid,
  initial,
  onSubmit,
  onCancel,
  submitText = 'Kaydet',
}: {
  uid: string;
  initial?: Partial<BookFormValues>;
  onSubmit: (data: BookFormValues) => Promise<void>;
  onCancel?: () => void;
  submitText?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [totalPages, setTotalPages] = useState<number | ''>(
    typeof initial?.total_pages === 'number' ? initial!.total_pages : ''
  );
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '');
  const [isFinished, setIsFinished] = useState(initial?.is_finished ?? false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>();

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (e: any) {
      setMsg('Kapak yüklenemedi: ' + (e?.message || e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(undefined);
    if (!title.trim()) {
      setMsg('Kitap adı gerekli.');
      return;
    }
    await onSubmit({
      title: title.trim(),
      author: author?.trim() || null,
      total_pages: totalPages === '' ? null : Number(totalPages),
      cover_url: coverUrl || null,
      is_finished: !!isFinished,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm">Kitap adı</label>
          <input
            className="mt-1 w-full rounded-lg border p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Saatleri Ayarlama Enstitüsü"
          />
        </div>
        <div>
          <label className="text-sm">Yazar (opsiyonel)</label>
          <input
            className="mt-1 w-full rounded-lg border p-2"
            value={author ?? ''}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Örn. Ahmet Hamdi Tanpınar"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm">Toplam sayfa (opsiyonel)</label>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border p-2"
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Örn. 320"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm">Kapak URL (opsiyonel)</label>
          <input
            className="mt-1 w-full rounded-lg border p-2"
            value={coverUrl ?? ''}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://.../kapak.jpg"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border px-3 py-2 hover:bg-gray-50"
              disabled={uploading}
            >
              {uploading ? 'Yükleniyor…' : 'Kapak Yükle'}
            </button>
            {coverUrl && <span className="text-xs text-gray-600 truncate">Kapak ayarlandı ✔</span>}
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={isFinished} onChange={(e) => setIsFinished(e.target.checked)} />
        Bitti olarak işaretle
      </label>

      {/* Önizleme */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-4">
          <div className="h-20 w-16 overflow-hidden rounded bg-gray-100 border">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="Kapak" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-2xl">📘</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {title || <span className="text-gray-400">Kitap adı…</span>}
              {author ? <span className="text-gray-500"> — {author}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
          {submitText}
        </button>
        {onCancel && (
          <button type="button" className="rounded-lg border px-3 py-2 hover:bg-gray-50" onClick={onCancel}>
            Vazgeç
          </button>
        )}
      </div>
    </form>
  );
}
