import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import HeaderBar from "@/components/HeaderBar";
import { AuthProvider } from "@/lib/AuthContext"; // <-- BUNU EKLEDİĞİNİZDEN EMİN OLUN

export const metadata: Metadata = {
  title: "LGS Takip",
  description: "Çalışma ve okuma takibi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50 antialiased">
        <AuthProvider> {/* <-- BUNU EKLEDİĞİNİZDEN EMİN OLUN */}

          {/* === ÜST LOGO === */}
          <div className="flex justify-center py-2 bg-white border-b border-gray-600">
            {/* ... Image ... */}
          </div>

          {/* === ÜST MENÜ (HeaderBar) === */}
          <HeaderBar />

          {/* === OTURUM DİNLEYİCİSİ === */}
          {/* <AuthListener /> */} {/* <-- 2. BU SATIRI DA SİLİN (HATA BURADA) */}

          {/* === SAYFA İÇERİĞİ === */}
          <div className="mx-auto max-w-4xl px-3 sm:p-4">
            {children}
          </div>

        </AuthProvider> {/* <-- BUNU EKLEDİĞİNİZDEN EMİN OLUN */}
      </body>
    </html>
  );
}
