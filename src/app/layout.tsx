import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import HeaderBar from "@/components/HeaderBar";
import AuthListener from "@/components/AuthListener"; // <-- 1. YENİ SATIR (Import)

export const metadata: Metadata = {
  title: "LGS Takip",
  description: "Çalışma ve okuma takibi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50 antialiased">
        {/* === ÜST LOGO (HeaderBar'ın da üstünde) === */}
        <div className="flex justify-center py-2 bg-white border-b border-gray-600">
          <Image
            src="/logo.png"
            alt="derstakibim logo"
            width={152}
            height={38}
            className="h-9 w-auto"
            priority
          />
        </div>

        {/* === ÜST MENÜ (HeaderBar) === */}
        <HeaderBar />

        {/* === OTURUM DİNLEYİCİSİ (GÖRÜNMEZ) === */}
        <AuthListener /> {/* <-- 2. YENİ SATIR (Kullanım) */}

        {/* === SAYFA İÇERİĞİ === */}
        <div className="mx-auto max-w-4xl px-3 sm:p-4">
          {children}
        </div>
      </body>
    </html>
  );
}
