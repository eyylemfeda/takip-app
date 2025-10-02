'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Invite = {
  id: string;
  email: string;
  role: string | null;
  code: string;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_by: string | null;
};

export default function AdminInvitesPage() {
  // --- oluşturma formu ---
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<string | null>(null);
  const [busyCreate, setBusyCreate] = useState(false);

  // --- liste ---
  const [rows, setRows] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? '');

  // Durum etiketi hesaplama
  function getStatus(inv: Invite) {
    const now = Date.now();
    if (inv.used_at) return { label: 'Kullanıldı', tone: 'bg-emerald-100 text-emerald-700' };
    if (inv.expires_at && new Date(inv.expires_at).getTime() < now) {
      return { label: 'Süresi doldu', tone: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'Aktif', tone: 'bg-blue-100 text-blue-700' };
  }

  const activeCount = useMemo(
    () =>
      rows.filter((r) => !r.used_at && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now())).length,
    [rows]
  );

  async function fetchInvites() {
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('invites')
        .select(
          'id,email,role,code,created_at,created_by,expires_at,used_at,used_by'
        )
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data as Invite[]) ?? []);
    } catch (e: any) {
      setMsg(e?.message || 'Davetler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvites();
  }, []);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLink(null);
    setBusyCreate(true);
    try {
      const { data, error } = await supabase.rpc('create_invite', {
        p_email: email,
        p_role: role,
        p_days: days,
      });
      if (error) throw error;

      const { code, expires_at } = (data as any[])[0];
      const url = `${baseUrl}/signup?code=${encodeURIComponent(code)}`;

      setLink(url);
      setMsg(`Davet oluşturuldu. Son kullanma: ${new Date(expires_at).toLocaleString('tr-TR')}`);
      setEmail('');
      // listeyi güncelle
      fetchInvites();
    } catch (e: any) {
      setMsg(e?.message || 'Hata oluştu.');
    } finally {
      setBusyCreate(false);
    }
  }

  function copy(val: string) {
    navigator.clipboard.writeText(val).then(() => {
      setMsg('Kopyalandı 📋');
      setTimeout(() => setMsg(null), 1500);
    });
  }

  async function expireInvite(inv: Invite) {
    if (inv.used_at) return;
    const ok = confirm(`${inv.email} için daveti iptal etmek (süresini hemen sonlandırmak) istiyor musun?`);
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('invites')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      fetchInvites();
      setMsg('Davet iptal edildi.');
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setMsg(e?.message || 'İptal edilemedi.');
    }
  }
//sayfa kenarlıklarını p-0 ile ayarladım
  return (
    <main className="p-0 space-y-3">
      <h1 className="text-2xl font-bold">Davetler</h1>

      {/* Özet */}
      <div className="text-sm text-gray-600">
        Toplam: <b>{rows.length}</b> • Aktif: <b>{activeCount}</b>
      </div>

      {/* Davet oluştur */}
      <section className="rounded-2xl border bg-white px-2 sm:px-3 md:px-4 py-3 shadow-sm space-y-3">
        <h2 className="font-semibold mb-2 sm:mb-3">Yeni Davet Oluştur</h2>
        <form onSubmit={createInvite} className="space-y-3">
          <div>
            <label className="text-sm">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="ogrenci@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="student">Öğrenci</option>
                <option value="parent">Veli</option>
                <option value="coach">Koç</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Geçerlilik (gün)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value || '0') || 1)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busyCreate}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busyCreate ? 'Oluşturuluyor…' : 'Davet Oluştur'}
          </button>
        </form>

        {link && (
          <div className="mt-3 space-y-1">
            <p className="text-sm text-gray-600">Link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={link}
                className="flex-1 border rounded px-3 py-2 bg-gray-50"
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
              />
              <button onClick={() => copy(link)} className="rounded border px-3 py-2 hover:bg-gray-50">
                Kopyala
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Liste */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-2 sm:mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Davet Listesi</h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchInvites} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
              Yenile
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">Henüz davet yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-2 py-2">Durum</th>
                  <th className="px-2 py-2">E-posta</th>
                  <th className="px-2 py-2">Rol</th>
                  <th className="px-2 py-2">Oluşturma</th>
                  <th className="px-2 py-2">Bitiş</th>
                  <th className="px-2 py-2">Kullanan</th>
                  <th className="px-2 py-2">Link</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = getStatus(r);
                  const signupUrl = `${baseUrl}/signup?code=${encodeURIComponent(r.code)}`;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-2 py-2">{r.email}</td>
                      <td className="px-2 py-2">{r.role || '-'}</td>
                      <td className="px-2 py-2">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                      <td className="px-2 py-2">
                        {r.expires_at ? new Date(r.expires_at).toLocaleString('tr-TR') : '-'}
                      </td>
                      <td className="px-2 py-2">
                        {r.used_at
                          ? `${new Date(r.used_at).toLocaleString('tr-TR')}`
                          : '—'}
                      </td>
                      <td className="px-2 py-2 max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={signupUrl}
                            className="flex-1 border rounded px-2 py-1 bg-gray-50"
                            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                          />
                          <button
                            onClick={() => copy(signupUrl)}
                            className="rounded border px-2 py-1 hover:bg-gray-50"
                          >
                            Kopyala
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {!r.used_at &&
                          (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()) && (
                            <button
                              onClick={() => expireInvite(r)}
                              className="rounded border px-3 py-1.5 hover:bg-gray-50"
                              title="Süresini hemen bitir"
                            >
                              İptal Et
                            </button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </section>
    </main>
  );
}
