'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
  Calendar, Clock, BookOpen, MapPin, Trash2, Plus, Quote,
  Target, School, Coffee, Trophy, Percent, Download, Loader2
} from 'lucide-react';
import Link from 'next/link';
// PDF Kütüphaneleri
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/* ========= TİPLER ========= */
type Block = {
  start: string;
  end: string;
  activity: string;
  type: 'lesson' | 'break' | 'school' | 'course' | 'activity' | 'bilsem';
};

type DaySchedule = {
  day: string;
  blocks: Block[];
};

type StudyPlan = {
  id: string;
  target_details: {
    school_name: string;
    min_score: number;
    percentile: string;
    estimated_score?: number;
    estimated_percentile?: number;
    motivation?: string;
  };
  weekly_schedule: {
    expert_advice: string;
    schedule: DaySchedule[];
  };
  created_at: string;
};

export default function PlannerPage() {
  const { uid, loading: authLoading } = useAuth();
  const router = useRouter();

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // PDF için içeriği kapsayan referans
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!uid) return;

    async function fetchPlan() {
      const { data } = await supabase
        .from('study_plans')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .single();

      if (data) setPlan(data);
      setLoading(false);
    }
    fetchPlan();
  }, [uid, authLoading]);

  const deletePlan = async () => {
    if (!confirm('Bu programı silmek istediğine emin misin?')) return;
    if (!plan) return;
    const { error } = await supabase.from('study_plans').delete().eq('id', plan.id);
    if (!error) { setPlan(null); router.refresh(); }
  };

  /* ======================================================== */
  /* PDF İNDİRME FONKSİYONU                                   */
  /* ======================================================== */
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);

    try {
      const element = printRef.current;

      // 1. Görünümü PDF için optimize et (Genişlik zorla ki günler yan yana olsun)
      const originalStyle = element.style.cssText;
      // Genişliği artırarak grid yapısının bozulmamasını sağlıyoruz (Desktop görünümü zorla)
      element.style.width = '1400px';
      element.style.padding = '20px';
      element.style.backgroundColor = '#ffffff';

      // 2. Yüksek kalitede ekran görüntüsü al
      const canvas = await html2canvas(element, {
        scale: 2, // Retina kalitesi için 2x
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // 3. Stili eski haline getir
      element.style.cssText = originalStyle;

      // 4. PDF Oluştur (Landscape - Yatay A4)
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape (yatay)

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Resmi sayfaya sığdır
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Eğer tek sayfaya sığmıyorsa sığdır, sığıyorsa ortala
      let finalHeight = imgHeight;
      let finalWidth = pdfWidth;

      if (imgHeight > pdfHeight) {
          // Sayfa boyunu aşıyorsa küçült
          const ratio = pdfHeight / imgHeight;
          finalHeight = pdfHeight - 10; // 10mm margin
          finalWidth = finalWidth * ratio - 10;
      }

      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

      // Okul adını dosya adı yap
      const safeName = plan?.target_details.school_name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'programim';
      pdf.save(`${safeName}_calisma_programi.pdf`);

    } catch (error) {
      console.error('PDF Hatası:', error);
      alert('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getScheduleList = (): DaySchedule[] => {
    if (!plan || !plan.weekly_schedule) return [];
    if (plan.weekly_schedule.schedule && Array.isArray(plan.weekly_schedule.schedule)) return plan.weekly_schedule.schedule;
    if (Array.isArray(plan.weekly_schedule)) return plan.weekly_schedule;
    return [];
  };

  const getDurationText = (start: string, end: string) => {
    try {
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      return `${diff} dk Mola`;
    } catch (e) { return 'Mola'; }
  };

  const scheduleList = getScheduleList();

  let advice = plan?.weekly_schedule?.expert_advice || "";
  const schoolNameSimple = plan?.target_details?.school_name?.split(' ')[0];
  if (schoolNameSimple && advice.includes(schoolNameSimple) && advice.length > 50) {
     advice = advice.replace(new RegExp(schoolNameSimple, 'gi'), 'Şampiyon');
  }

  const target = plan ? {
      name: plan.target_details.school_name || "Hedefim",
      score: plan.target_details.min_score || plan.target_details.estimated_score,
      percentile: plan.target_details.percentile || plan.target_details.estimated_percentile,
      motivation: plan.target_details.motivation
  } : null;

  if (authLoading || loading) return <div className="p-8 text-center">Programın yükleniyor...</div>;

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <div className="bg-blue-100 p-4 rounded-full"><Calendar size={48} className="text-blue-600" /></div>
        <h1 className="text-2xl font-bold text-gray-800">Henüz bir çalışma programın yok.</h1>
        <p className="text-gray-600 max-w-md">Yapay zeka destekli koçumuzla sana özel program hazırlayalım mı?</p>
        <Link href="/planner/create" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
          <Plus size={20} /> Hemen Program Oluştur
        </Link>
      </div>
    );
  }

  return (
    <main className="space-y-6 pb-10">

      {/* ÜST BAR: Başlık ve Butonlar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-blue-600" /> Haftalık Planım
         </h2>
         <div className="flex gap-2 w-full sm:w-auto">
            <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all shadow-sm disabled:opacity-70"
            >
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isDownloading ? 'Hazırlanıyor...' : 'PDF İndir (A4)'}
            </button>

            <Link href="/planner/create" className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center justify-center">
                Yenile
            </Link>
            <button onClick={deletePlan} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium border border-red-100 flex items-center justify-center">
                <Trash2 size={18} />
            </button>
         </div>
      </div>

      {/* --- YAZDIRILACAK ALAN BAŞLANGICI --- */}
      {/* Bu div'in içindeki her şey PDF'te görünecek */}
      <div ref={printRef} className="space-y-6 bg-gray-50/50 p-2 rounded-xl">

          {/* 1. HEDEF BİLGİSİ (KOMPAKT) */}
          {target && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Target size={10} /> HEDEFİM
                    </span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight leading-tight">
                        {target.name.split('(')[0].trim()}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                    {target.score && (
                        <div className="flex items-center gap-1.5 text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                        <Trophy size={14} className="text-orange-600" />
                        <span className="font-bold">{target.score}</span>
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">Puan</span>
                        </div>
                    )}
                    {target.percentile && (
                        <div className="flex items-center gap-1.5 text-gray-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                        <Percent size={14} className="text-blue-600" />
                        <span className="font-bold">%{target.percentile}</span>
                        <span className="text-gray-500 text-[10px] uppercase font-semibold">Dilim</span>
                        </div>
                    )}
                    </div>
                </div>
                {target.motivation && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-3 rounded-lg max-w-md">
                    <p className="text-sm text-indigo-900 italic font-medium leading-relaxed">
                        "{target.motivation}"
                    </p>
                    </div>
                )}
                </div>
            </div>
          )}

          {/* 2. UZMAN GÖRÜŞÜ (KOMPAKT) */}
          {advice && (
            <div className="bg-white p-4 rounded-xl border-l-4 border-indigo-500 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-indigo-100 rounded-full text-indigo-600 shrink-0 mt-0.5">
                  <Quote size={16} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Koç Stratejisi</h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {advice}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. PROGRAM GRID (YANYANA GÖRÜNÜM İÇİN 4 KOLON ZORLANDI) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {scheduleList.map((dayPlan, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="bg-gray-100 p-2 border-b border-gray-200 font-bold text-gray-700 text-center uppercase tracking-wide text-xs">
                    {dayPlan.day}
                </div>
                <div className="p-2 space-y-1 flex-1">
                  {dayPlan.blocks.length === 0 ? <p className="text-center text-gray-400 text-xs py-2">-</p> : dayPlan.blocks.map((block, bIdx) => {

                    const isBreak = block.type === 'break';
                    let colorClass = "bg-gray-50 border-gray-100 text-gray-600";

                    let displayActivity = block.activity;

                    if (isBreak) {
                        colorClass = "bg-green-50/50 border-green-100/50 text-green-700/70 text-[10px] border-0 justify-center";
                        displayActivity = getDurationText(block.start, block.end);
                    } else if (block.type === 'lesson') {
                        colorClass = "bg-blue-50 border-blue-100 text-blue-900 shadow-sm font-semibold";
                    }
                    else if (block.type === 'school') { colorClass = "bg-orange-50 border-orange-100 text-orange-900"; }
                    else if (block.type === 'course' || block.type === 'bilsem') { colorClass = "bg-purple-50 border-purple-100 text-purple-900"; }
                    else if (block.type === 'activity') { colorClass = "bg-pink-50 border-pink-100 text-pink-900"; }

                    return (
                      <div key={bIdx} className={`px-2 py-1.5 rounded border text-xs flex gap-2 items-center ${colorClass} ${isBreak ? 'py-0.5 min-h-[20px]' : ''}`}>
                        <div className={`flex-1 ${isBreak ? 'text-center' : ''}`}>
                          <div className="leading-tight">{displayActivity}</div>
                          {!isBreak && <div className="text-[9px] opacity-70 font-medium">{block.start}-{block.end}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
      </div>
      {/* --- YAZDIRILACAK ALAN BİTİŞİ --- */}

    </main>
  );
}
