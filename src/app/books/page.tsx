'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BookRow = {
  id: string;
  user_id?: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_url: string | null;
  is_finished: boolean | null;
  status?: 'active' | 'paused' | 'finished' | null;
  created_at: string;
  updated_at?: string | null;
  finished_at?: string | null;
};

type SumMap = Record<string, number>;
type LastPageMap = Record<string, number>;

export default function BooksPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<BookRow[]>([]);
  const [sumByTitle, setSumByTitle] = useState<SumMap>({});
  const [sumTodayByTitle, setSumTodayByTitle] = useState<SumMap>({});
  const [lastPageByTitle, setLastPageByTitle] = useState<LastPageMap>({});
  const [busyId, setBusyId] = useState<string | null>(null);          // silme
  const [actionBusyId, setActionBusyId] = useState<string | null>(null); // durum değişikliği
  const [saveBusy, setSaveBusy] = useState<string | null>(null);      // kaldığım sayfa kaydı
  const [msg, setMsg] = useState<string>();

  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUid(id);
      if (!id) return;
      await fetchBooks();
      await fetchReadingSummaries();
    })();
  }, []);

  async function fetchBooks() {
    const { data: r, error } = await supabase
      .from('books')
      .select('id,user_id,title,author,total_pages,cover_url,is_finished,status,created_at,updated_at,finished_at')
      .order('created_at', { ascending: false });

    if (error) { setMsg(error.message); return; }
    setRows((r ?? []) as BookRow[]);
  }

  async function fetchReadingSummaries() {
    const { data: logs, error: logErr } = await supabase
      .from('reading_logs')
      .select('title,pages,created_at,page_number');

    if (logErr) {
      setSumByTitle({});
      setSumTodayByTitle({});
      setLastPageByTitle({});
      return;
    }

    const mm: SumMap = {};
    const mmToday: SumMap = {};
    const last: LastPageMap = {};
    const t0 = startOfToday().getTime();

    (logs ?? []).forEach((x: any) => {
      const t = (x.title || '').trim();
      if (!t) return;

      const p = Number(x.pages || 0);
      if (p > 0) {
        mm[t] = (mm[t] || 0) + p;
        const ts = new Date(x.created_at).getTime();
        if (ts >= t0) mmToday[t] = (mmToday[t] || 0) + p;
      }
      if (x.page_number != null) {
        const pn = Number(x.page_number);
        if (!Number.isNaN(pn)) last[t] = Math.max(last[t] || 0, pn);
      }
    });

    setSumByTitle(mm);
    setSumTodayByTitle(mmToday);
    setLastPageByTitle(last);
  }

  function bookStatus(b: BookRow): 'active' | 'paused' | 'finished' {
    if (b.status === 'active' || b.status === 'paused' || b.status === 'finished') return b.status;
    if (b.is_finished) return 'finished';
    return 'active';
  }

  const groups = useMemo(() => {
    const g = { active: [] as BookRow[], paused: [] as BookRow[], finished: [] as BookRow[] };
    rows.forEach((b) => {
      const s = bookStatus(b);
      if (s === 'active') g.active.push(b);
      else if (s === 'paused') g.paused.push(b);
      else g.finished.push(b);
    });
    return g;
  }, [rows]);

  // === DURUM DEĞİŞTİRME: finished_at dahil ===
  async function updateStatus(book: BookRow, nextStatus: 'active' | 'paused' | 'finished') {
    if (!uid) return;

    setActionBusyId(book.id);
    try {
      const nowISO = new Date().toISOString();
      const payload: any = {
        updated_at: nowISO,
      };

      // status kolonu varsa set edelim
      if ('status' in book) payload.status = nextStatus;

      if (nextStatus === 'finished') {
        payload.is_finished = true;
        payload.finished_at = nowISO;     // ✅ yeni kolon burada set edilir
      } else {
        payload.is_finished = false;
        payload.finished_at = null;       // aktif/pasif yapılınca temizle
      }

      const { error } = await supabase
        .from('books')
        .update(payload)
        .eq('id', book.id)
        .eq('user_id', uid);

      if (error) throw error;

      // UI'da güncelle
      setRows(prev => prev.map(x => x.id === book.id ? { ...x, ...payload } : x));
    } catch (e: any) {
      setMsg('Güncelleme başarısız: ' + (e?.message || String(e)));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu kitabı silmek istediğine emin misin?')) return;
    setBusyId(id);
    setMsg(undefined);

    try {
      const { data: book, error: selErr } = await supabase
        .from('books')
        .select('title')
        .eq('id', id)
        .maybeSingle();
      if (selErr) throw selErr;

      const { error: delErr } = await supabase.from('books').delete().eq('id', id);
      if (delErr) throw delErr;

      setRows((prev) => prev.filter((x) => x.id !== id));
      if (book?.title) {
        setSumByTitle((s) => { const c = { ...s }; delete c[book.title]; return c; });
        setSumTodayByTitle((s) => { const c = { ...s }; delete c[book.title]; return c; });
        setLastPageByTitle((s) => { const c = { ...s }; delete c[book.title]; return c; });
      }
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetCurrentPage(b: BookRow, raw: string) {
    const current = Number((raw ?? '').trim());
    if (!uid) return alert('Oturum bulunamadı.');
    if (raw == null || raw === '' || isNaN(current) || current < 0) return alert('Geçerli bir sayfa girin');

    const alreadyRead = sumByTitle[b.title] || 0;
    const delta = current - alreadyRead;
    if (delta <= 0) return alert(`Girilen sayfa (${current}), mevcut toplam okumanın (${alreadyRead}) altında/eşit. Daha yüksek bir değer girin.`);
    if (b.total_pages && current > b.total_pages) {
      if (!confirm(`Girilen sayfa (${current}), toplam sayfayı (${b.total_pages}) aşıyor. Yine de kaydedilsin mi?`)) return;
    }

    setSaveBusy(b.id);
    try {
      const { error } = await supabase.from('reading_logs').insert({
        user_id: uid,
        title: b.title,
        pages: delta,
        page_number: current,
      });
      if (error) throw error;

      setSumByTitle((s) => ({ ...s, [b.title]: (s[b.title] || 0) + delta }));
      setSumTodayByTitle((s) => ({ ...s, [b.title]: (s[b.title] || 0) + delta }));
      setLastPageByTitle((s) => ({ ...s, [b.title]: current }));
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaveBusy(null);
    }
  }

  function BookRowItem({ b }: { b: BookRow }) {
    const read = sumByTitle[b.title] || 0;
    const total = b.total_pages || 0;
    const remain = total ? Math.max(total - read, 0) : null;
    const pct = total ? Math.min(100, Math.round((read / total) * 100)) : null;
    const readToday = sumTodayByTitle[b.title] || 0;
    const lastPage = lastPageByTitle[b.title] ?? undefined;

    const status = bookStatus(b);
    const showFinishAndPause = status === 'active';
    const showActivate = status === 'paused' || status === 'finished';

    const pageRef = useRef<HTMLInputElement>(null); // uncontrolled

    return (
      <tr className="border-t align-middle">
        {/* Kapak */}
        <td className="p-3">
          <div className="h-14 w-10 overflow-hidden rounded bg-gray-100 border">
            {b.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-lg">📘</div>
            )}
          </div>
        </td>

        {/* Ad & Yazar */}
        <td className="p-3 font-medium">{b.title}</td>
        <td className="p-3 text-gray-600">{b.author ?? '-'}</td>

        {/* İlerleme + bugün/kaldığım sayfa + bar */}
        <td className="p-3 w-[360px]">
          <div className="text-xs mb-1 flex items-center justify-between">
            <span className="text-emerald-700"><b>Bugün okuduğum:</b> {readToday} sayfa</span>
            {lastPage !== undefined && <span className="text-gray-700">Kaldığım sayfa: <b>{lastPage}</b></span>}
          </div>
          <div className="text-xs mb-1">
            {total ? (
              <>Okunan: <b>{read}</b> · Kalan: <b>{remain}</b> · %{pct}</>
            ) : (
              <>Okunan: <b>{read}</b> · Toplam sayfa belirtilmemiş</>
            )}
          </div>
          <div className="relative h-2 w-full rounded-full bg-gray-200">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-indigo-500"
              style={{ width: pct ? `${pct}%` : (read > 0 ? '8%' : '0%') }}
            />
          </div>
        </td>

        {/* İşlemler */}
        <td className="p-3 text-right whitespace-nowrap">
          <div className="flex items-center gap-2 justify-end flex-wrap">
            {/* Kaldığım sayfa (UNCONTROLLED) */}
            <input
              ref={pageRef}
              type="number"
              min={0}
              placeholder={'Kaldığım sayfa'}
              className="w-36 rounded border p-1 text-sm"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <button
              onClick={() => handleSetCurrentPage(b, pageRef.current?.value || '')}
              disabled={saveBusy === b.id}
              className="rounded bg-orange-500 text-white px-3 py-1 text-sm hover:bg-orange-600"
            >
              {saveBusy === b.id ? 'Kaydediliyor…' : 'Kaydet'}
            </button>

            {/* Durum aksiyonları */}
            {showFinishAndPause && (
              <>
                <button
                  onClick={() => updateStatus(b, 'finished')}
                  disabled={actionBusyId === b.id}
                  className="rounded bg-green-600 text-white px-2 py-1 text-sm hover:bg-green-700"
                  title="Bu kitabı bitmiş olarak işaretle"
                >
                  {actionBusyId === b.id ? 'İşleniyor…' : 'Kitap Bitti'}
                </button>
                <button
                  onClick={() => updateStatus(b, 'paused')}
                  disabled={actionBusyId === b.id}
                  className="rounded bg-yellow-500 text-white px-2 py-1 text-sm hover:bg-yellow-600"
                  title="Bu kitabı pasif (sonra okuyacağım) durumuna al"
                >
                  {actionBusyId === b.id ? 'İşleniyor…' : 'Sonra Okuyacağım'}
                </button>
              </>
            )}

            {showActivate && (
              <button
                onClick={() => updateStatus(b, 'active')}
                disabled={actionBusyId === b.id}
                className="rounded bg-blue-600 text-white px-2 py-1 text-sm hover:bg-blue-700"
                title="Bu kitabı tekrar aktif hale getir"
              >
                {actionBusyId === b.id ? 'İşleniyor…' : 'Tekrar Aktif Et'}
              </button>
            )}

            {/* Düzenle / Sil */}
            <Link
              href={`/books/${b.id}/edit`}
              className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
            >
              Düzenle
            </Link>
            <button
              onClick={() => handleDelete(b.id)}
              disabled={busyId === b.id}
              className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
            >
              {busyId === b.id ? 'Siliniyor…' : 'Sil'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (!uid) {
    return (
      <main className="p-6 space-y-2">
        <p>Bu sayfa için giriş gerekiyor.</p>
        <Link className="text-blue-600 hover:underline" href="/login">Giriş yap</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kitaplarım</h1>
        <div className="flex items-center gap-2">
          <Link href="/reading-logs" className="rounded-lg border px-3 py-2 hover:bg-gray-50">
            Okuma Kayıtlarım
          </Link>
          <Link href="/books/new" className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700">
            Yeni Kitap Ekle
          </Link>
        </div>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {/* AKTİF */}
      <section className="rounded-xl border bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold">Aktif</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Kapak</th>
                <th className="p-3 text-left">Adı</th>
                <th className="p-3 text-left">Yazar</th>
                <th className="p-3 text-left">İlerleme</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.active.map((b) => <BookRowItem key={b.id} b={b} />)}
              {groups.active.length === 0 && (
                <tr><td className="p-6 text-gray-500" colSpan={5}>Aktif kitap yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PASİF */}
      <section className="rounded-xl border bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold">Pasif</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Kapak</th>
                <th className="p-3 text-left">Adı</th>
                <th className="p-3 text-left">Yazar</th>
                <th className="p-3 text-left">İlerleme</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.paused.map((b) => <BookRowItem key={b.id} b={b} />)}
              {groups.paused.length === 0 && (
                <tr><td className="p-6 text-gray-500" colSpan={5}>Pasif kitap yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* BİTEN */}
      <section className="rounded-xl border bg-white shadow-sm">
        <div className="px-4 py-3 border-b font-semibold">Biten</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Kapak</th>
                <th className="p-3 text-left">Adı</th>
                <th className="p-3 text-left">Yazar</th>
                <th className="p-3 text-left">İlerleme</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {groups.finished.map((b) => <BookRowItem key={b.id} b={b} />)}
              {groups.finished.length === 0 && (
                <tr><td className="p-6 text-gray-500" colSpan={5}>Biten kitap yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
