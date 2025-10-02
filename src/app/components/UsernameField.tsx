'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';

const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/i;

type CheckState = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'reserved';

export default function UsernameField() {
  const { uid } = useRequireActiveUser(); // sayfan zaten guard'lı, burada uid kesinleşir
  const [orig, setOrig] = useState<string>('');     // DB'deki mevcut username
  const [val, setVal] = useState<string>('');       // input değeri
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CheckState>('idle');

  // İlk yükleme: mevcut username'i çek
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', uid)
        .single();
      const u = (data?.username || '').trim();
      setOrig(u);
      setVal(u);
      setState('idle');
    })();
  }, [uid]);

  // Kullanılabilirlik kontrolü (debounce)
  useEffect(() => {
    setMsg(null);
    if (!val || val === orig) { setState('idle'); return; }
    if (!USERNAME_RE.test(val)) { setState('invalid'); return; }

    setState('checking');
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('check_username_available', { p_username: val });
        if (data === true) setState('available');
        else setState('taken'); // reserved/çok kısa vb. durumlarda da false döner
      } catch {
        // hata olursa çok agresif olmayalım
        setState('checking');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [val, orig]);

  const canSave = useMemo(() => {
    if (!val) return false;
    if (val === orig) return false;
    if (state === 'available' || state === 'idle') return true; // idle durumu regex+rpc arası kısa anlar
    return false;
  }, [val, orig, state]);

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      if (!USERNAME_RE.test(val)) throw new Error('Geçersiz kullanıcı adı biçimi.');
      const { error } = await supabase.rpc('set_username', { p_username: val });
      if (error) throw error;

      setOrig(val);
      setState('idle');
      setMsg('Kullanıcı adın güncellendi.');
    } catch (e: any) {
      const raw = String(e?.message || e);
      // RPC'den gelebilecek olası mesajları kullanıcı-dostu göster
      if (/alınmış/i.test(raw)) setMsg('Bu kullanıcı adı alınmış.');
      else if (/rezervli/i.test(raw)) setMsg('Bu kullanıcı adı rezervli.');
      else if (/geçersiz/i.test(raw)) setMsg('Geçersiz kullanıcı adı.');
      else if (/değiştiremezsiniz/i.test(raw)) setMsg('Şu an kullanıcı adını değiştiremezsiniz.');
      else setMsg(raw);
    } finally {
      setBusy(false);
    }
  }

  // Durum rozeti
  function Badge() {
    if (val === orig || state === 'idle') return null;
    const base = 'ml-2 rounded px-2 py-0.5 text-xs font-medium';
    if (state === 'invalid') return <span className={`${base} bg-red-100 text-red-700`}>Geçersiz</span>;
    if (state === 'checking') return <span className={`${base} bg-gray-100 text-gray-700`}>Kontrol ediliyor…</span>;
    if (state === 'available') return <span className={`${base} bg-emerald-100 text-emerald-700`}>Uygun</span>;
    if (state === 'taken') return <span className={`${base} bg-amber-100 text-amber-700`}>Kullanımda</span>;
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <label htmlFor="username" className="block text-sm font-medium text-gray-900">
          Kullanıcı adı
        </label>
        <Badge />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="username"
          value={val}
          onChange={(e) => setVal(e.target.value.trim())}
          placeholder="ör. hakan_34"
          className="w-full rounded border px-3 py-2"
          autoComplete="off"
        />
        <button
          onClick={onSave}
          disabled={!canSave || busy}
          className="whitespace-nowrap rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}

      {(!orig || orig.length === 0) && (
        <p className="text-xs text-amber-700">
          İlk kez belirliyorsun: Lütfen benzersiz bir kullanıcı adı seç.
        </p>
      )}
      <p className="text-xs text-gray-500">
        3–20 karakter; harf, rakam, “._-” kullanılabilir.
      </p>
    </div>
  );
}
