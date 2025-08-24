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
        <div className="mx-auto max-w-4xl p-4">{children}</div>
      </body>
    </html>
  );
}
