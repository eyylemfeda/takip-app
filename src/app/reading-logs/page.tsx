'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type LogRow = {
  id: string;
  title: string;
  pages: number | null;
  page_number: number | null;
  created_at: string;
};

export default function ReadingLogsPage() {
  const [uid, setUid] = useState<string | null>(null);

  // filtreler
  const [title, setTitle] = useState<string>('');         // kitap adı
  const [dateFrom, setDateFrom] = useState<string>('');   // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>('');       // yyyy-mm-dd
  const [minPages, setMinPages] = useState<string>('');   // sayı
  const [maxPages, setMaxPages] = useState<string>('');   // sayı

  // veriler
  const [rows, setRows] = useState<LogRow[]>([]);
  const [bookTitles, setBookTitles] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>();

  // inline edit/sil durumları
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ pages: string; page_number: string }>({ pages: '', page_number: '' });
  const [busyId, setBusyId] = useState<string | null>(null); // silme/save sırasında

  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  // oturum + kitap isimlerini yükle (select için)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUid(id);
      if (!id) return;

      // reading_logs + books birleşik başlık seti
      const { data: titlesData } = await supabase
        .from('reading_logs')
        .select('title')
        .eq('user_id', id);

      const set = new Set<string>();
      (titlesData ?? []).forEach((x: any) => {
        const t = (x.title || '').trim();
        if (t) set.add(t);
      });

      const { data: books } = await supabase
        .from('books')
        .select('title')
        .order('created_at', { ascending: false });

      (books ?? []).forEach((b: any) => {
        const t = (b.title || '').trim();
        if (t) set.add(t);
      });

      const arr = Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'tr'));
      setBookTitles(arr);
    })();
  }, []);

  async function load() {
    if (!uid) return;
    setMsg(undefined);

    let q = supabase
      .from('reading_logs')
      .select('id,title,pages,page_number,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (title) q = q.eq('title', title);

    if (dateFrom) {
      const fromIso = new Date(dateFrom).toISOString();
      q = q.gte('created_at', fromIso);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1); // bitiş gününü dahil et
      q = q.lt('created_at', to.toISOString());
    }

    if (minPages) q = q.gte('pages', Number(minPages));
    if (maxPages) q = q.lte('pages', Number(maxPages));

    const { data, error } = await q.returns<LogRow[]>();
    if (error) setMsg('Hata: ' + error.message);
    else setRows(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  function clearFilters() {
    setTitle('');
    setDateFrom('');
    setDateTo('');
    setMinPages('');
    setMaxPages('');
  }

  const todayTotal = useMemo(() => {
    const t0 = startOfToday().getTime();
    return rows.reduce((acc, r) => {
      if (new Date(r.created_at).getTime() >= t0) {
        return acc + (r.pages || 0);
      }
      return acc;
    }, 0);
  }, [rows]);

  const totals = useMemo(() => {
    const totalPages = rows.reduce((acc, r) => acc + (r.pages || 0), 0);
    return { count: rows.length, pages: totalPages };
  }, [rows]);

  // --- Inline Edit ---
  function startEdit(r: LogRow) {
    setEditingId(r.id);
    setEditValues({
      pages: r.pages != null ? String(r.pages) : '',
      page_number: r.page_number != null ? String(r.page_number) : '',
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValues({ pages: '', page_number: '' });
  }
  async function saveEdit(id: string) {
    const pagesNum = editValues.pages.trim() === '' ? null : Number(editValues.pages);
    const pageNum  = editValues.page_number.trim() === '' ? null : Number(editValues.page_number);
    if (pagesNum !== null && (isNaN(pagesNum) || pagesNum < 0)) return alert('Geçerli bir "okunan sayfa" girin.');
    if (pageNum  !== null && (isNaN(pageNum)  || pageNum  < 0)) return alert('Geçerli bir "kaldığım sayfa" girin.');

    setBusyId(id);
    try {
      const { error } = await supabase
        .from('reading_logs')
        .update({ pages: pagesNum, page_number: pageNum })
        .eq('id', id);
      if (error) throw error;

      // UI'ı güncelle
      setRows(prev => prev.map(r => r.id === id ? { ...r, pages: pagesNum, page_number: pageNum } : r));
      cancelEdit();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  // --- Delete ---
  async function handleDelete(id: string) {
    if (!confirm('Bu okuma kaydını silmek istediğine emin misin?')) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from('reading_logs').delete().eq('id', id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

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

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Okuma Kayıtlarım</h1>
        <div className="flex items-center gap-2">
          <Link href="/books" className="rounded-lg border px-3 py-2 hover:bg-gray-50">
            Kitaplarım
          </Link>
        </div>
      </div>

      {/* Filtreler */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Kitap</label>
            <select
              className="w-full rounded-lg border p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              <option value="">(Hepsi)</option>
              {bookTitles.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Başlangıç</label>
            <input
              type="date"
              className="w-full rounded-lg border p-2"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Bitiş</label>
            <input
              type="date"
              className="w-full rounded-lg border p-2"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Min. Sayfa</label>
            <input
              type="number"
              className="w-full rounded-lg border p-2"
              value={minPages}
              onChange={(e) => setMinPages(e.target.value)}
              placeholder="örn. 5"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Maks. Sayfa</label>
            <input
              type="number"
              className="w-full rounded-lg border p-2"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
              placeholder="örn. 50"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={load} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
            Filtrele
          </button>
          <button
            onClick={() => { clearFilters(); setTimeout(load, 0); }}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50"
          >
            Temizle
          </button>
        </div>

        {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      </section>

      {/* Özet */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>Toplam Kayıt: <b>{totals.count}</b></div>
          <div>Toplam Okunan: <b>{totals.pages}</b> sayfa</div>
          <div>Bugün Okunan: <b>{todayTotal}</b> sayfa</div>
        </div>
      </section>

      {/* Liste */}
      <section className="rounded-xl border bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold">Kayıtlar</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Tarih</th>
                <th className="p-3 text-left">Kitap</th>
                <th className="p-3 text-left">Okunan Sayfa</th>
                <th className="p-3 text-left">Kaldığım Sayfa</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <tr key={r.id} className="border-t align-middle">
                    <td className="p-3">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-3">{r.title}</td>

                    {/* Okunan Sayfa */}
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-24 rounded border p-1 text-sm"
                          value={editValues.pages}
                          onChange={(e) => setEditValues(v => ({ ...v, pages: e.target.value }))}
                        />
                      ) : (
                        r.pages ?? '-'
                      )}
                    </td>

                    {/* Kaldığım Sayfa */}
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-28 rounded border p-1 text-sm"
                          value={editValues.page_number}
                          onChange={(e) => setEditValues(v => ({ ...v, page_number: e.target.value }))}
                        />
                      ) : (
                        r.page_number ?? '-'
                      )}
                    </td>

                    {/* İşlemler */}
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(r.id)}
                              disabled={busyId === r.id}
                              className="rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
                            >
                              {busyId === r.id ? 'Kaydediliyor…' : 'Kaydet'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                            >
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={busyId === r.id}
                              className="rounded border px-3 py-1 text-sm text-red-600 border-red-200 hover:bg-red-50"
                            >
                              {busyId === r.id ? 'Siliniyor…' : 'Sil'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-gray-500" colSpan={5}>
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
