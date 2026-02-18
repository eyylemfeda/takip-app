import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // --- MOBİL İÇİN EKLENEN ZORUNLU AYARLAR ---
  output: 'export',        // Dosyaları HTML'e çevirir (Sunucuyu kapatır)
  images: {
    unoptimized: true,     // Resim optimizasyonunu kapatır (Next/Image hatasını önler)
  },

  // --- SİZİN MEVCUT AYARLARINIZ (KORUNDU) ---
  eslint: { 
    ignoreDuringBuilds: true 
  },
  typescript: { 
    ignoreBuildErrors: true 
  },
  
  // headers() KISMI KALDIRILDI
  // Çünkü statik export modunda sunucu headerları çalışmaz.
};

export default nextConfig;