'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, BookOpen, UserRound, LogOut } from 'lucide-react';

type Profile = { full_name?: string | null };

export default function HeaderBar() {
  const supabase = createClient();

  const [email, setEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);

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
          .select('full_name')
          .eq('id', u.id)
          .maybeSingle();

        if (!mounted) return;
        setProfile(prof ?? null);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_evt, session) => {
        const u = session?.user ?? null;
        setEmail(u?.email ?? '');

        if (u?.id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', u.id)
            .maybeSingle();
          setProfile(prof ?? null);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const displayName = profile?.full_name || email || '';

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
        {/* Sol: başlık + kullanıcı adı */}
        <div>
          <h1 className="text-2xl font-bold">Çalışma Panelim</h1>
          {displayName ? (
            <p className="-mt-1 text-sm italic text-gray-500">{displayName}</p>
          ) : null}
        </div>

        {/* Sağ: renkli butonlar + ikonlar */}
        <nav className="flex flex-wrap gap-2">
          <Link
            href="/records/new"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
            aria-label="Kayıt Ekle"
          >
            <Plus size={16} /> Kayıt Ekle
          </Link>

          <Link
            href="/books"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
            aria-label="Kitap Listem"
          >
            <BookOpen size={16} /> Kitap Listem
          </Link>

          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-md bg-slate-600 px-3 py-1.5 text-white hover:bg-slate-700"
            aria-label="Profil"
          >
            <UserRound size={16} /> Profil
          </Link>

          <button
            onClick={async () => { await supabase.auth.signOut(); location.href = '/login'; }}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
            aria-label="Çıkış"
          >
            <LogOut size={16} /> Çıkış
          </button>
        </nav>
      </div>
    </header>
  );
}
