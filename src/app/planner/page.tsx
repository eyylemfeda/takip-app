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
  /* PDF İNDİRME FONKSİYONU (RENK HATASI FİXLENDİ)            */
  /* ======================================================== */
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);

    const element = printRef.current;
    // Orijinal stili yedeğe al
    const originalStyle = element.style.cssText;

    try {
      // 1. Görünümü PDF için zorla (A4 Yatay sığması için genişlik veriyoruz)
      element.style.width = '1400px';
      element.style.padding = '20px';
      element.style.backgroundColor = '#ffffff';

      // 2. Fotoğrafı Çek
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff', // Arkaplanı kesin beyaz yap
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1400
      });

      // 3. PDF Oluştur
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let finalHeight = imgHeight;
      let finalWidth = pdfWidth;

      // Sayfaya sığmazsa küçült
      if (imgHeight > pdfHeight) {
          const ratio = pdfHeight / imgHeight;
          finalHeight = pdfHeight - 10;
          finalWidth = finalWidth * ratio - 10;
      }

      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

      const safeName = plan?.target_details.school_name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'programim';
      pdf.save(`${safeName}_calisma_programi.pdf`);

    } catch (error) {
      console.error('PDF Hatası:', error);
      alert('PDF oluşturulurken bir hata oluştu. Tarayıcı önbelleğini temizlemeyi deneyin.');
    } finally {
      // 4. Stili MUTLAKA eski haline getir (Mobilde bozulmasın diye)
      element.style.cssText = originalStyle;
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

      {/* ÜST BAR */}
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
      {/* ÖNEMLİ: Burada 'oklch' renk hatasını önlemek için Tailwind renk classlarını (bg-blue-50 vb.) KULLANMIYORUZ.
          Hepsi style={{ backgroundColor: '#HEX' }} şeklinde manuel veriliyor. */}
      <div ref={printRef} className="space-y-6 p-4 rounded-xl" style={{ backgroundColor: '#f9fafb' }}>

          {/* 1. HEDEF BİLGİSİ */}
          {target && (
            <div className="p-5 rounded-xl shadow-sm border" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}> {/* bg-blue-100, text-blue-700 */}
                        <Target size={10} /> HEDEFİM
                    </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight leading-tight" style={{ color: '#1f2937' }}>
                        {target.name.split('(')[0].trim()}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                    {target.score && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded border"
                             style={{ backgroundColor: '#ffedd5', borderColor: '#fed7aa', color: '#374151' }}> {/* bg-orange-50 */}
                            <Trophy size={14} style={{ color: '#ea580c' }} />
                            <span className="font-bold">{target.score}</span>
                            <span className="text-[10px] uppercase font-semibold" style={{ color: '#6b7280' }}>Puan</span>
                        </div>
                    )}
                    {target.percentile && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded border"
                             style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe', color: '#374151' }}> {/* bg-blue-50 */}
                            <Percent size={14} style={{ color: '#2563eb' }} />
                            <span className="font-bold">%{target.percentile}</span>
                            <span className="text-[10px] uppercase font-semibold" style={{ color: '#6b7280' }}>Dilim</span>
                        </div>
                    )}
                    </div>
                </div>
                {target.motivation && (
                    <div className="p-3 rounded-lg max-w-md"
                         style={{ backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}> {/* bg-indigo-50 */}
                        <p className="text-sm italic font-medium leading-relaxed" style={{ color: '#312e81' }}>
                            "{target.motivation}"
                        </p>
                    </div>
                )}
                </div>
            </div>
          )}

          {/* 2. UZMAN GÖRÜŞÜ */}
          {advice && (
            <div className="p-4 rounded-xl shadow-sm"
                 style={{ backgroundColor: '#ffffff', borderLeft: '4px solid #6366f1' }}>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-full mt-0.5" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                  <Quote size={16} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#111827' }}>Koç Stratejisi</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
                    {advice}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. PROGRAM GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {scheduleList.map((dayPlan, idx) => (
              <div key={idx} className="rounded-lg shadow-sm border overflow-hidden flex flex-col"
                   style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                <div className="p-2 border-b font-bold text-center uppercase tracking-wide text-xs"
                     style={{ backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' }}>
                    {dayPlan.day}
                </div>
                <div className="p-2 space-y-1 flex-1">
                  {dayPlan.blocks.length === 0 ? <p className="text-center text-xs py-2" style={{ color: '#9ca3af' }}>-</p> : dayPlan.blocks.map((block, bIdx) => {

                    const isBreak = block.type === 'break';
                    let boxStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
                    let displayActivity = block.activity;

                    // NOT: Renkleri Tailwind class'ı ile değil, HEX kodu ile veriyoruz.
                    // oklch hatasını önlemek için bu şart.
                    if (isBreak) {
                        // Mola (Yeşilimsi)
                        boxStyle = { ...boxStyle, backgroundColor: '#f0fdf4', color: '#15803d', justifyContent: 'center', border: 'none', fontSize: '10px' };
                        displayActivity = getDurationText(block.start, block.end);
                    } else if (block.type === 'lesson') {
                        // Ders (Mavi)
                        boxStyle = { ...boxStyle, backgroundColor: '#eff6ff', color: '#1e3a8a', borderColor: '#dbeafe', borderStyle: 'solid', borderWidth: '1px', fontWeight: '600' };
                    }
                    else if (block.type === 'school') {
                        // Okul (Turuncu)
                        boxStyle = { ...boxStyle, backgroundColor: '#fff7ed', color: '#9a3412', borderColor: '#ffedd5', borderStyle: 'solid', borderWidth: '1px' };
                    }
                    else if (block.type === 'course' || block.type === 'bilsem') {
                        // Kurs (Mor)
                        boxStyle = { ...boxStyle, backgroundColor: '#faf5ff', color: '#6b21a8', borderColor: '#f3e8ff', borderStyle: 'solid', borderWidth: '1px' };
                    }
                    else if (block.type === 'activity') {
                        // Aktivite (Pembe)
                        boxStyle = { ...boxStyle, backgroundColor: '#fdf2f8', color: '#9d174d', borderColor: '#fce7f3', borderStyle: 'solid', borderWidth: '1px' };
                    } else {
                        // Varsayılan (Gri)
                        boxStyle = { ...boxStyle, backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' };
                    }

                    return (
                      <div key={bIdx} className={`px-2 py-1.5 rounded text-xs ${isBreak ? 'py-0.5 min-h-[20px]' : ''}`} style={boxStyle}>
                        <div className={`flex-1 ${isBreak ? 'text-center' : ''}`}>
                          <div className="leading-tight">{displayActivity}</div>
                          {!isBreak && <div className="text-[9px] font-medium" style={{ opacity: 0.7 }}>{block.start}-{block.end}</div>}
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
