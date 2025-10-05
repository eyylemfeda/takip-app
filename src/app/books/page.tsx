'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { startOfToday } from 'date-fns';
import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author?: string | null;
  total_pages?: number | null;
  cover_url?: string | null;
  is_finished?: boolean | null;
  status?: 'active' | 'paused' | 'finished' | null;
  created_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
};

type SumMap = Record<string, number>;
type LastPageMap = Record<string, number>;



export default function BooksPage() {
  // 🔒 Login + aktiflik koruması (hook)
  const { uid, loading } = useRequireActiveUser();

  const [rows, setRows] = useState<BookRow[]>([]);
  const [msg, setMsg] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // okuma özetleri
  const [sumByTitle, setSumByTitle] = useState<SumMap>({});
  const [sumTodayByTitle, setSumTodayByTitle] = useState<SumMap>({});
  const [lastPageByTitle, setLastPageByTitle] = useState<LastPageMap>({});
  const [saveBusy, setSaveBusy] = useState<string | null>(null);

  // 📥 Kitapları getir (uid hazır olunca)
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: r, error } = await supabase
        .from('books')
        .select(
          'id,user_id,title,author,total_pages,cover_url,is_finished,status,created_at,updated_at,finished_at'
        )
        .eq('user_id', uid) // sadece kendi kitapların
        .order('created_at', { ascending: false });

      if (error) {
        setMsg(error.message);
        return;
      }
      setRows((r ?? []) as BookRow[]);
    })();
  }, [uid]);

  // 📈 Okuma özetlerini getir (uid hazır olunca)
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: logs, error: logErr } = await supabase
        .from('reading_logs')
        .select('title,pages,created_at,page_number')
        .eq('user_id', uid); // sadece kendi logların

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
    })();
  }, [uid]);

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
      const payload: any = { updated_at: nowISO };

      // status kolonu varsa set edelim
      if ('status' in book) payload.status = nextStatus;

      if (nextStatus === 'finished') {
        payload.is_finished = true;
        payload.finished_at = nowISO;
      } else {
        payload.is_finished = false;
        payload.finished_at = null;
      }

      const { error } = await supabase
        .from('books')
        .update(payload)
        .eq('id', book.id)
        .eq('user_id', uid);
      if (error) throw error;

      // UI'da güncelle
      setRows((prev) => prev.map((x) => (x.id === book.id ? { ...x, ...payload } : x)));
    } catch (e: any) {
      setMsg('Güncelleme başarısız: ' + (e?.message || String(e)));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!uid) return;
    if (!confirm('Bu kitabı silmek istediğine emin misin?')) return;
    setBusyId(id);
    setMsg(undefined);

    try {
      const { data: book, error: selErr } = await supabase
        .from('books')
        .select('title')
        .eq('id', id)
        .eq('user_id', uid)
        .maybeSingle();
      if (selErr) throw selErr;

      const { error: delErr } = await supabase
        .from('books')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (delErr) throw delErr;

      setRows((prev) => prev.filter((x) => x.id !== id));
      if (book?.title) {
        setSumByTitle((s) => {
          const c = { ...s };
          delete c[book.title];
          return c;
        });
        setSumTodayByTitle((s) => {
          const c = { ...s };
          delete c[book.title];
          return c;
        });
        setLastPageByTitle((s) => {
          const c = { ...s };
          delete c[book.title];
          return c;
        });
      }
    } catch (e: any) {
      setMsg('Silme başarısız: ' + (e?.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }

  // === SATIR BİLEŞENİ: masaüstü tablolar için
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
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-emerald-700">
              <b>Bugün okuduğum:</b> {readToday} sayfa
            </span>
            {lastPage !== undefined && (
              <span className="text-gray-700">
                Kaldığım sayfa: <b>{lastPage}</b>
              </span>
            )}
          </div>
          <div className="mb-1 text-xs">
            {total ? (
              <>
                Okunan: <b>{read}</b> · Kalan: <b>{remain}</b> · %{pct}
              </>
            ) : (
              <>
                Okunan: <b>{read}</b> · Toplam sayfa belirtilmemiş
              </>
            )}
          </div>
          <div className="relative h-2 w-full rounded-full bg-gray-200">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-indigo-500"
              style={{ width: pct ? `${pct}%` : read > 0 ? '4px' : '0px' }}
            />
          </div>

          {/* Kaldığım sayfayı ekle */}
          <div className="mt-2 flex items-center gap-2 text-sm">
            <input
              ref={pageRef}
              type="number"
              inputMode="numeric"
              placeholder={lastPage ? String(lastPage) : 'Örn. 185'}
              className="w-24 rounded border px-2 py-1"
            />
            <button
              onClick={async () => {
                const current = Number(pageRef.current?.value || 0);
                if (!current || Number.isNaN(current)) return;
                const prev = lastPage ?? 0;
                const delta = Math.max(0, current - prev);
                const title = b.title;

                setSaveBusy(b.id);
                try {
                  const { error } = await supabase.from('reading_logs').insert({
                    user_id: uid,
                    title,
                    pages: delta,
                    page_number: current,
                  });
                  if (error) throw error;

                  setSumByTitle((s) => ({ ...s, [title]: (s[title] || 0) + delta }));
                  setSumTodayByTitle((s) => ({ ...s, [title]: (s[title] || 0) + delta }));
                  setLastPageByTitle((s) => ({ ...s, [title]: current }));
                } catch (e: any) {
                  alert(e?.message || String(e));
                } finally {
                  setSaveBusy(null);
                }
              }}
              disabled={saveBusy === b.id}
              className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            >
              {saveBusy === b.id ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </td>

        {/* Aksiyonlar */}
        <td className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Durum aksiyonları */}
            {showFinishAndPause && (
              <>
                <button
                  onClick={() => updateStatus(b, 'finished')}
                  disabled={actionBusyId === b.id}
                  className="rounded bg-emerald-600 px-2 py-1 text-sm text-white hover:bg-emerald-700"
                >
                  {actionBusyId === b.id ? 'İşleniyor…' : 'Bitti'}
                </button>
                <button
                  onClick={() => updateStatus(b, 'paused')}
                  disabled={actionBusyId === b.id}
                  className="rounded bg-yellow-600 px-2 py-1 text-sm text-white hover:bg-yellow-700"
                >
                  {actionBusyId === b.id ? 'İşleniyor…' : 'Sonra Okuyacağım'}
                </button>
              </>
            )}

            {showActivate && (
              <button
                onClick={() => updateStatus(b, 'active')}
                disabled={actionBusyId === b.id}
                className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
                title="Bu kitabı tekrar aktif hale getir"
              >
                {actionBusyId === b.id ? 'İşleniyor…' : 'Tekrar Aktif Et'}
              </button>
            )}

            {/* Düzenle / Sil */}
            <Link href={`/books/${b.id}/edit`} className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50">
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

  // === MOBİL: "Okuma Kitabım" kartı (aktif kitabın özeti)
  function MobileReadingPanel() {
    const b = groups.active[0]; // ilk aktif kitap
    if (!b) {
      return (
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="mb-2 text-base font-semibold">Okuma Kitabım</div>
          <div className="text-sm text-gray-500">Aktif kitabın yok.</div>
        </div>
      );
    }

    const read = sumByTitle[b.title] || 0;
    const total = b.total_pages || 0;
    const remain = total ? Math.max(total - read, 0) : null;
    const pct = total ? Math.min(100, Math.round((read / total) * 100)) : null;
    const readToday = sumTodayByTitle[b.title] || 0;
    const lastPage = lastPageByTitle[b.title] ?? undefined;

    const inputRef = useRef<HTMLInputElement>(null);

    return (
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-3 text-base font-semibold">Okuma Kitabım</div>

        <div className="flex items-start gap-3">
          {/* Kapak mobil görüntü 35 25 */}
          <div className="h-35 w-25 overflow-hidden rounded border bg-gray-100">
            {b.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl">📘</div>
            )}
          </div>

          {/* Bilgiler */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{b.title}</div>
            <div className="truncate text-xs text-gray-600">{b.author ?? '-'}</div>

            <div className="mt-2 grid gap-1 text-xs">
              <div className="text-green-600 font-medium">
                Bugün okuduğum: <b>{readToday}</b> sayfa
              </div>
              <div>
                Okunan: <b>{read}</b> {total ? <>· Kalan: <b>{remain}</b></> : null}
              </div>
              {lastPage !== undefined && (
                <div>
                  Hangi sayfadayım: <b>{lastPage}</b>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-2 w-full bg-white border rounded h-6 relative overflow-hidden">
              <div
                className="bg-orange-500 h-full"
                style={{ width: pct ? `${pct}%` : read > 0 ? '4px' : '0px' }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black">
                İlerleme: %{pct ?? 0}
              </span>
            </div>

            {/* Kaldığım sayfayı ekle */}
            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
              <span className="leading-tight">
                Kaldığın sayfayı gir ve <br />
                <b>Kaydet</b>’e bas.
              </span>

              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                placeholder={lastPage ? String(lastPage) : 'Örn. 185'}
                className="w-10 h-7 rounded border px-2 text-sm"
              />

              <button
                onClick={async () => {
                  const current = Number(inputRef.current?.value || 0);
                  if (!current || Number.isNaN(current)) return;
                  const prev = lastPage ?? 0;
                  const delta = Math.max(0, current - prev);

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
                }}
                disabled={saveBusy === b.id}
                className="h-7 rounded bg-green-600 px-2 text-sm text-white hover:bg-green-700"
              >
                {saveBusy === b.id ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🔄 Kanca kontrol aşamasında loader
  if (loading) {
    return (
      <main className="space-y-2 p-6">
        <p className="text-sm text-gray-600">Yükleniyor…</p>
      </main>
    );
  }

  // 🚪 uid yoksa render etme (kanca /login'e attı)
  if (!uid) return null;

  // ✅ Normal render
  return (
    <main className="mx-auto max-w-none md:max-w-5xl px-2 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-8">
      {/* Üst başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kitaplarım</h1>
        <div className="flex items-center gap-1 md:gap-2">
          <Link
            href="/reading-logs"
            className="flex items-center justify-center rounded-md border border-gray-400 text-sm px-3 h-8 whitespace-nowrap hover:bg-gray-50"
            title="Okuma Kayıtlarım"
          >
            <span className="inline md:hidden">Kayıtlar</span>
            <span className="hidden md:inline">Okuma Kayıtlarım</span>
          </Link>

          <Link
            href="/books/new"
            className="flex items-center justify-center rounded-md border border-gray-400 bg-green-600 text-white text-sm px-3 h-8 whitespace-nowrap hover:bg-green-700"
            title="Yeni Kitap Ekle"
          >
            Yeni Kitap
          </Link>
        </div>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {/* ===== MOBİL: 3 PANELLİ YATAY KAYDIRMA ===== */}
      <div className="md:hidden -mx-3 px-1">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto">
          {/* Panel 1: Okuma Kitabım */}
          <div className="min-w-full snap-start">
            <MobileReadingPanel />
          </div>

          {/* Panel 2: Kitaplar */}
          <div className="min-w-full snap-start space-y-3">
            <section className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-3 py-2 font-semibold">Aktif</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Kapak</th>
                      <th className="p-2 text-left">Adı</th>
                      <th className="p-2 text-left">Yazar</th>
                      <th className="p-2 text-left">İlerleme</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.active.map((b) => (
                      <BookRowItem key={b.id} b={b} />
                    ))}
                    {groups.active.length === 0 && (
                      <tr>
                        <td className="p-4 text-gray-500" colSpan={5}>
                          Aktif kitap yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-3 py-2 font-semibold">Pasif</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Kapak</th>
                      <th className="p-2 text-left">Adı</th>
                      <th className="p-2 text-left">Yazar</th>
                      <th className="p-2 text-left">İlerleme</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.paused.map((b) => (
                      <BookRowItem key={b.id} b={b} />
                    ))}
                    {groups.paused.length === 0 && (
                      <tr>
                        <td className="p-4 text-gray-500" colSpan={5}>
                          Pasif kitap yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-3 py-2 font-semibold">Biten</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Kapak</th>
                      <th className="p-2 text-left">Adı</th>
                      <th className="p-2 text-left">Yazar</th>
                      <th className="p-2 text-left">İlerleme</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.finished.map((b) => (
                      <BookRowItem key={b.id} b={b} />
                    ))}
                    {groups.finished.length === 0 && (
                      <tr>
                        <td className="p-4 text-gray-500" colSpan={5}>
                          Biten kitap yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Panel 3: Okuma kayıtları kısayolu */}
          <div className="min-w-full snap-start">
            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="mb-2 text-base font-semibold">Okuma Kayıtları</div>
              <p className="mb-3 text-sm text-gray-600">
                Tüm güncel okuma kayıtlarını görmek için listeye git.
              </p>
              <Link
                href="/reading-logs"
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Kayıtlar listesine git
              </Link>
            </div>
          </div>
        </div>

        {/* küçük ipucu */}
        <div className="mt-2 flex justify-center gap-2 text-[11px] text-gray-500">
          <span>◀︎ sola kaydır: kitaplar</span>
          <span>•</span>
          <span>bir daha kaydır: kayıtlar</span>
        </div>
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="hidden md:block space-y-2 lg:space-y-4">
        {/* AKTİF */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3 font-semibold">Aktif</div>
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
                {groups.active.map((b) => (
                  <BookRowItem key={b.id} b={b} />
                ))}
                {groups.active.length === 0 && (
                  <tr>
                    <td className="p-6 text-gray-500" colSpan={5}>
                      Aktif kitap yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PASİF */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3 font-semibold">Pasif</div>
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
                {groups.paused.map((b) => (
                  <BookRowItem key={b.id} b={b} />
                ))}
                {groups.paused.length === 0 && (
                  <tr>
                    <td className="p-6 text-gray-500" colSpan={5}>
                      Pasif kitap yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* BİTEN */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3 font-semibold">Biten</div>
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
                {groups.finished.map((b) => (
                  <BookRowItem key={b.id} b={b} />
                ))}
                {groups.finished.length === 0 && (
                  <tr>
                    <td className="p-6 text-gray-500" colSpan={5}>
                      Biten kitap yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
