'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, BookOpen } from 'lucide-react'; // ikonlar

type ProfileRow = { is_admin?: boolean; full_name?: string; avatar_url?: string };

export default function HeaderBar() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user || null;
      setUid(u?.id ?? null);
      setEmail(u?.email ?? '');

      if (!u?.id) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_admin, full_name, avatar_url')
        .eq('id', u.id)
        .maybeSingle();
      setProfile(prof ?? null);
    })();
  }, []);

  const isAdmin = !!profile?.is_admin;
  const displayName = profile?.full_name || email;
  const initial = (displayName || 'U')[0]?.toUpperCase?.() ?? 'U';

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Sol: Uygulama adı */}
        <Link href="/" className="text-lg font-semibold">
          Çalışma Panelim
        </Link>

        {/* Sağ taraf */}
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="grid h-8 w-8 place-items-center rounded-full border bg-gray-50 text-sm">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="avatar"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          {/* Kullanıcı adı */}
          <div className="mx-2 truncate text-sm font-medium max-w-[16rem]" title={displayName}>
            {displayName}
          </div>

          {/* Admin (kırmızı) */}
          {isAdmin && (
            <Link
              href="/admin/topics"
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              Admin
            </Link>
          )}

          {/* Kayıt Ekle (mavi + ikonlu) */}
          <Link
            href="/records/new"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Kayıt Ekle
          </Link>

          {/* Kitap Listem (yeşil, book ikonlu) */}
          <Link
            href="/books"
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            <BookOpen className="h-4 w-4" />
            Kitap Listem
          </Link>

          {/* Profil */}
          <Link
            href="/profile"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Profil
          </Link>

          {/* Çıkış */}
          <button
            onClick={handleLogout}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Çıkış
          </button>
        </div>
      </div>
    </header>
  );
}
