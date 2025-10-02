import "./globals.css";
import type { Metadata } from "next";
import HeaderBar from "@/components/HeaderBar";

export const metadata: Metadata = {
  title: "LGS Takip",
  description: "Çalışma ve okuma takibi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50 antialiased">
        <HeaderBar />
        {/* Mobilde daha dar padding (px-1),
            küçük ekran üstünde (sm ve sonrası) eski padding (p-4) korunur */}
        <div className="mx-auto max-w-4xl px-3 sm:p-4">
          {children}
        </div>
      </body>
    </html>
  );
}
