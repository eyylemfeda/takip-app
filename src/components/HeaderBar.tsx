'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, BookOpen, UserRound, LogOut, Shield, Menu, X } from 'lucide-react';

type Profile = {
  full_name?: string | null;
  is_admin?: boolean | null;
};

export default function HeaderBar() {
  const supabase = createClient();

  const [email, setEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false); // mobil menü

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (!mounted) return;

      setEmail(u?.email ?? '');

      if (u?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name,is_admin')
          .eq('id', u.id)
          .maybeSingle();

        if (!mounted) return;
        setProfile(prof ?? null);
      } else {
        setProfile(null);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user ?? null;
      setEmail(u?.email ?? '');

      if (u?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name,is_admin')
          .eq('id', u.id)
          .maybeSingle();
        setProfile(prof ?? null);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const displayName = profile?.full_name || email || '';

  async function handleSignOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    window.location.replace('/login');
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-10 py-1 flex items-center justify-between">
        {/* Sol: başlık + kullanıcı adı */}
        <div className="min-w-0">
          <Link href="/" className="inline-block no-underline hover:no-underline">
            <h1 className="text-2xl font-bold">Çalışma Panelim</h1>
          </Link>
          {displayName ? (
            <p className="-mt-1 truncate text-m italic text-gray-500">{displayName}</p>
          ) : null}
        </div>

          {/* Sağ: masaüstü buton grubu (kompakt) */}
        <nav className="hidden sm:flex items-center gap-1.5">
          <Link
            href="/records/new"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700
                      h-8 md:h-9 px-2.5 md:px-3 text-sm"
            aria-label="Kayıt Ekle"
          >
            <Plus size={14} className="mr-1.5" />
            Kayıt Ekle
          </Link>

          <Link
            href="/books"
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700
                      h-8 md:h-9 px-2.5 md:px-3 text-sm"
            aria-label="Kitap Listem"
          >
            <BookOpen size={14} className="mr-1.5" />
            Kitap Listem
          </Link>

          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-md bg-slate-600 text-white hover:bg-slate-700
                      h-8 md:h-9 px-2.5 md:px-3 text-sm"
            aria-label="Profil"
          >
            <UserRound size={14} className="mr-1.5" />
            Profil
          </Link>

          {profile?.is_admin ? (
            <Link
              href="/admin/topics"
              className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white hover:bg-amber-700
                        h-8 md:h-9 px-2.5 md:px-3 text-sm"
              title="Yönetim"
            >
              <Shield size={14} className="mr-1.5" />
              Admin
            </Link>
          ) : null}

          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-md bg-rose-600 text-white hover:bg-rose-700
                      h-8 md:h-9 px-2.5 md:px-3 text-sm"
            aria-label="Çıkış"
          >
            <LogOut size={14} className="mr-1.5" />
            Çıkış
          </button>
        </nav>


        {/* Sağ: mobil hamburger butonu */}
        <button
          className="sm:hidden inline-flex items-center rounded-md border px-2.5 py-2 hover:bg-gray-50"
          aria-label="Menüyü aç/kapat"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobil: sağdan panel (1/3 genişlik), yarı saydam panel arkaplanı, panel yüksekliği içerik kadar */}
      {open && (
        <div className="sm:hidden fixed right-0 top-2 z-50 w-4/7 pr-2">
          <div className="ml-auto max-h-[85vh] overflow-auto rounded-2xl border bg-white/60 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Menü</span>
              <button
                aria-label="Kapat"
                className="inline-flex items-center rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <nav className="p-1">
              <Link
                href="/records/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-black/5"
              >
                <Plus size={18} /> Kayıt Ekle
              </Link>

              <Link
                href="/books"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-black/5"
              >
                <BookOpen size={18} /> Kitap Listem
              </Link>

              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-black/5"
              >
                <UserRound size={18} /> Profil
              </Link>

              {profile?.is_admin ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-black/5"
                >
                  <Shield size={18} /> Admin
                </Link>
              ) : null}

              <button
                onClick={async () => { setOpen(false); await handleSignOut(); }}
                className="mt-1 flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-black/5"
              >
                <LogOut size={18} /> Çıkış
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
