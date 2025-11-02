'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext'; // <-- 1. "Tek Kaptan"ı import et
import {
  Plus,
  BookOpen,
  Menu as MenuIcon,
  Shield,
  User as UserIcon,
  LogOut,
  UserPlus,
  BarChart2
} from 'lucide-react';

export default function HeaderBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 2. TÜM BİLGİLERİ 'useAuth'dan AL (Veritabanı sorgusu YOK)
  const { session, profile, loading } = useAuth();

  const isAuthed = !!session;
  const isAdmin = (profile?.role === 'admin' || profile?.role === 'coach');
  const displayName = (profile?.full_name || session?.user?.email || '').trim();

  // 3. (Silindi) Artık 'useEffect' ve 'useState(profile)' YOK.

  // 4. Logout fonksiyonu basitleşti
  async function handleLogout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    // AuthListener (Kaptan 1) zaten /login'e yönlendirecek,
    // router.replace'e gerek yok.
  }

  const NameLine = displayName ? (
    <div
      className="text-sm text-gray-600 italic mt-0.5 truncate"
      title={displayName}
    >
      {displayName}
    </div>
  ) : null;

  // 🔑 Login durumuna göre başlık linki
  const homeHref = isAuthed ? '/' : '/login';

  // Auth sayfalarında minimal header göster (menüsüz)
  const isAuthFlow =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot' ||
    pathname?.startsWith('/auth/');

  if (isAuthFlow) {
    return (
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-3 px-3">
          <a href="/" className="font-semibold">Çalışma Panelim</a>
        </div>
      </header>
    );
  }

  // Yüklenme sırasında boş bir header göster (donmayı engeller)
  if (loading) {
    return (
       <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
         <div className="mx-auto hidden max-w-4xl items-center justify-between px-11 py-2 md:flex h-16">
           {/* Yüklenme iskeleti */}
         </div>
       </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      {/* === MOBILE === */}
      <div className="md:hidden">
        <div className="relative mx-auto max-w-4xl px-3 py-3" ref={rootRef}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <Link
                href={homeHref}
                className="text-base font-semibold text-black leading-tight truncate"
                title="Çalışma Panelim"
                onClick={() => setMenuOpen(false)}
              >
                Çalışma Panelim
              </Link>
              {NameLine}
            </div>
            <div className="ml-2">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Menüyü aç"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white/0 hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Dropdown */}
          <div
            role="menu"
            aria-label="Ana menü"
            aria-hidden={!menuOpen}
            className={[
              "absolute right-2 mt-2 w-max min-w-40 rounded-xl border bg-white/95 backdrop-blur",
              "shadow-lg ring-1 ring-black/5 p-1 origin-top-right",
              "transition duration-150 ease-out",
              menuOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none",
            ].join(" ")}
          >
            <div className="py-0.5">
              {isAdmin && (
                <>
                  {/* 5. GÜNCELLENDİ: Link artık /admin'e gidiyor */}
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-gray-50"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin Paneli</span>
                  </Link>
                </>
              )}
              {/* Diğer menü linkleri (Kayıt ekle, Kitap listem vb.) */}
              {/* 2. YENİ LİNK (Giriş yapmış VE admin DEĞİLSE göster) */}
              {isAuthed && !isAdmin && (
                <Link
                  href="/reports"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-gray-50"
                >
                  <BarChart2 className="h-4 w-4" />
                  <span>Raporlarım</span>
                </Link>
              )}
              <Link
                href="/records/new"
                role="menuitem"
                // ... (geri kalanı aynı)
              >
                <Plus className="h-4 w-4" />
                <span>Kayıt ekle</span>
              </Link>
              <Link
                href="/books"
                role="menuitem"
                // ... (geri kalanı aynı)
              >
                <BookOpen className="h-4 w-4" />
                <span>Kitap listem</span>
              </Link>
              <div className="my-1.5 border-t" />
              <Link
                href="/profile"
                role="menuitem"
                // ... (geri kalanı aynı)
              >
                <UserIcon className="h-4 w-4" />
                <span>Profil</span>
              </Link>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === DESKTOP === */}
      <div className="mx-auto hidden max-w-4xl items-center justify-between px-11 py-2 md:flex">
        <div className="flex flex-col min-w-0">
          <Link href={homeHref} className="text-lg font-semibold leading-tight truncate" title="Çalışma Panelim">
            Çalışma Panelim
          </Link>
          {NameLine}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              {/* 5. GÜNCELLENDİ: Link artık /admin'e gidiyor */}
              <Link
                href="/admin"
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Admin Paneli
              </Link>
            </>
          )}
          {/* Diğer desktop linkleri */}
          <Link
            href="/records/new"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Kayıt Ekle
          </Link>
          <Link
            href="/books"
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            <BookOpen className="h-4 w-4" />
            Kitap Listem
          </Link>
          <Link
            href="/profile"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Profil
          </Link>
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
