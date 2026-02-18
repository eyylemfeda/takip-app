'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react';

function EditBookForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // DEĞİŞİKLİK BURADA: ID'yi query string'den alıyoruz (?id=123)
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    total_pages: '',
  });

  useEffect(() => {
    async function fetchBook() {
      if (!id) return;

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Hata:', error);
        alert('Kitap bulunamadı!');
        router.push('/books');
      } else if (data) {
        setFormData({
          title: data.title || '',
          author: data.author || '',
          total_pages: data.total_pages?.toString() || '',
        });
      }
      setLoading(false);
    }

    fetchBook();
  }, [id, router]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);

    const { error } = await supabase
      .from('books')
      .update({
        title: formData.title,
        author: formData.author,
        total_pages: parseInt(formData.total_pages) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      alert('Güncelleme hatası: ' + error.message);
    } else {
      router.push('/books');
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm('Bu kitabı silmek istediğinize emin misiniz?')) return;
    
    setSaving(true);
    const { error } = await supabase.from('books').delete().eq('id', id);
    
    if (error) {
      alert('Silinemedi: ' + error.message);
      setSaving(false);
    } else {
      router.push('/books');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Kitap bilgileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border overflow-hidden mt-4">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">Kitabı Düzenle</h1>
        <button 
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 p-2"
          title="Kitabı Sil"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <form onSubmit={handleUpdate} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kitap Adı</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Yazar</label>
          <input
            type="text"
            value={formData.author}
            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sayfa Sayısı</label>
          <input
            type="number"
            required
            value={formData.total_pages}
            onChange={(e) => setFormData({ ...formData, total_pages: e.target.value })}
            className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="pt-4 flex gap-3">
          <Link
            href="/books"
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-center flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            İptal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditBookPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <Suspense fallback={<div className="text-center p-10">Yükleniyor...</div>}>
        <EditBookForm />
      </Suspense>
    </div>
  );
}