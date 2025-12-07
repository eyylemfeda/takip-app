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
import html2canvas from 'html2canvas-pro';
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

  // PDF için gizli alanı referans alacağız
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
  /* PDF İNDİRME (GİZLİ ALANIN FOTOĞRAFINI ÇEKER)             */
  /* ======================================================== */
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);

    const element = printRef.current;

    try {
      // 1. Gizli alanın fotoğrafını çek
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1600 // Geniş pencere simülasyonu
      });

      // 2. PDF Oluştur
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let finalHeight = imgHeight;
      let finalWidth = pdfWidth;

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
      alert('PDF oluşturulamadı.');
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

  // PDF Düzeni İçin Günleri Ayır
  const weekDays = scheduleList.slice(0, 5);
  const weekendDays = scheduleList.slice(5, 7);

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

  // --- PDF KUTU ÇİZME YARDIMCISI ---
  const renderPdfDayColumn = (dayPlan: DaySchedule, isWeekend = false) => (
    <div key={dayPlan.day} style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
    }}>
      <div style={{
          backgroundColor: isWeekend ? '#f3e8ff' : '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          padding: '6px',
          fontWeight: 'bold',
          textAlign: 'center',
          textTransform: 'uppercase',
          fontSize: '11px',
          color: isWeekend ? '#6b21a8' : '#374151'
      }}>
          {dayPlan.day}
      </div>
      <div style={{ padding: '6px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {dayPlan.blocks.length === 0 ?
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', padding: '8px 0' }}>-</p>
          :
          dayPlan.blocks.map((block, bIdx) => {
            const isBreak = block.type === 'break';
            let bg = '#eff6ff'; let border = '#dbeafe'; let text = '#1e3a8a'; let weight = '600';
            let displayActivity = block.activity;

            if (isBreak) {
                bg = '#f0fdf4'; border = 'transparent'; text = '#15803d';
                // PDF'te sadece "10 dk" yazsın, yer kazanalım
                try {
                    const [h1, m1] = block.start.split(':').map(Number);
                    const [h2, m2] = block.end.split(':').map(Number);
                    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                    displayActivity = `${diff} dk Mola`;
                } catch { displayActivity = 'Mola'; }
                weight = 'normal';
            } else if (block.type === 'school') {
                bg = '#fff7ed'; border = '#ffedd5'; text = '#9a3412';
            } else if (block.type === 'course' || block.type === 'bilsem') {
                bg = '#faf5ff'; border = '#f3e8ff'; text = '#6b21a8';
            } else if (block.type === 'activity') {
                bg = '#fdf2f8'; border = '#fce7f3'; text = '#9d174d';
            }

            return (
              <div key={bIdx} style={{
                  backgroundColor: bg,
                  border: `1px solid ${border}`,
                  color: text,
                  padding: isBreak ? '2px' : '4px 6px',
                  borderRadius: '4px',
                  fontSize: isBreak ? '9px' : '10px',
                  textAlign: 'center',
                  minHeight: isBreak ? '16px' : 'auto'
              }}>
                <div style={{ lineHeight: '1.2', fontWeight: weight, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {displayActivity}
                </div>
                {!isBreak && <div style={{ fontSize: '8px', fontWeight: '500', opacity: 0.7 }}>{block.start}-{block.end}</div>}
              </div>
            );
        })}
      </div>
    </div>
  );

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
    <main className="space-y-6 pb-10 relative">

      {/* ======================================================== */}
      {/* 1. EKRANDA GÖRÜNEN KISIM (WEB ARAYÜZÜ - RESPONSIVE)      */}
      {/* ======================================================== */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-blue-600" /> Haftalık Planım
         </h2>
         <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all shadow-sm disabled:opacity-70">
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isDownloading ? 'Hazırlanıyor...' : 'PDF İndir (A4)'}
            </button>
            <Link href="/planner/create" className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center justify-center">Yenile</Link>
            <button onClick={deletePlan} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium border border-red-100 flex items-center justify-center"><Trash2 size={18} /></button>
         </div>
      </div>

      {/* --- NORMAL GÖRÜNÜM BAŞLANGICI --- */}
      <div className="space-y-6">
          {/* HEDEF BİLGİSİ */}
          {target && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Target size={12} /> HEDEFİM
                    </span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight leading-tight">
                        {target.name.split('(')[0].trim()}
                    </h1>
                    <div className="flex items-center gap-3 mt-3 text-sm">
                    {target.score && (
                        <div className="flex items-center gap-1.5 text-gray-700 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                        <Trophy size={16} className="text-orange-600" />
                        <span className="font-bold">{target.score}</span>
                        <span className="text-gray-500 text-xs uppercase font-semibold">Puan</span>
                        </div>
                    )}
                    {target.percentile && (
                        <div className="flex items-center gap-1.5 text-gray-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        <Percent size={16} className="text-blue-600" />
                        <span className="font-bold">%{target.percentile}</span>
                        <span className="text-gray-500 text-xs uppercase font-semibold">Dilim</span>
                        </div>
                    )}
                    </div>
                </div>
                {target.motivation && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-4 rounded-xl max-w-md shadow-sm">
                    <p className="text-sm text-indigo-900 italic font-medium leading-relaxed">"{target.motivation}"</p>
                    </div>
                )}
                </div>
            </div>
          )}

          {/* UZMAN GÖRÜŞÜ */}
          {advice && (
            <div className="bg-white p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm relative overflow-hidden">
              <div className="flex items-start gap-4 relative z-10">
                <div className="p-2 bg-indigo-100 rounded-full text-indigo-600 shrink-0 mt-1"><Quote size={20} /></div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-gray-900">Haftalık Koç Stratejisi</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{advice}</p>
                </div>
              </div>
            </div>
          )}

          {/* PROGRAM GRID (RESPONSIVE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scheduleList.map((dayPlan, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300">
                <div className="bg-gray-50/80 p-3 border-b border-gray-100 font-bold text-gray-700 text-center uppercase tracking-wide text-xs">
                    {dayPlan.day}
                </div>
                <div className="p-2 space-y-1.5 flex-1">
                  {dayPlan.blocks.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Boş gün 🎉</p> : dayPlan.blocks.map((block, bIdx) => {
                    const isBreak = block.type === 'break';
                    let colorClass = "bg-gray-50 border-gray-100 text-gray-600";
                    let icon = <Clock size={14} />;
                    let displayActivity = block.activity;
                    let displayTime = `${block.start} - ${block.end}`;

                    if (isBreak) {
                        colorClass = "bg-green-50/50 border-green-100/50 text-green-700/70 text-xs border-0 justify-center";
                        icon = <Coffee size={12} className="hidden" />;
                        displayActivity = getDurationText(block.start, block.end);
                        displayTime = "";
                    } else if (block.type === 'lesson') {
                        colorClass = "bg-blue-50 border-blue-100 text-blue-900 shadow-sm"; icon = <BookOpen size={14} className="text-blue-500" />;
                    } else if (block.type === 'school') {
                        colorClass = "bg-orange-50 border-orange-100 text-orange-900"; icon = <School size={14} className="text-orange-500" />;
                    } else if (block.type === 'course' || block.type === 'bilsem') {
                        colorClass = "bg-purple-50 border-purple-100 text-purple-900"; icon = <MapPin size={14} className="text-purple-500" />;
                    } else if (block.type === 'activity') {
                        colorClass = "bg-pink-50 border-pink-100 text-pink-900"; icon = <Clock size={14} className="text-pink-500" />;
                    }

                    return (
                      <div key={bIdx} className={`px-3 py-2 rounded-lg border text-sm flex gap-3 items-center ${colorClass} ${isBreak ? 'py-1 min-h-[24px]' : ''}`}>
                        {!isBreak && <div className="shrink-0">{icon}</div>}
                        <div className={`flex-1 ${isBreak ? 'text-center font-medium' : ''}`}>
                          <div className={isBreak ? '' : 'font-semibold leading-tight'}>{displayActivity}</div>
                          {!isBreak && <div className="text-[10px] opacity-70 mt-0.5 font-medium">{displayTime}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
      </div>
      {/* --- NORMAL GÖRÜNÜM BİTİŞİ --- */}


      {/* ======================================================== */}
      {/* 2. PDF İÇİN GİZLİ ALAN (KULLANICI GÖRMEZ)                */}
      {/* ======================================================== */}
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '1600px', zIndex: -1000 }}>
          <div ref={printRef} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', color: '#000000' }}>

              {/* ORTA HEDEF */}
              {target && (
                <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #f3f4f6', paddingBottom: '15px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                        {target.name.split('(')[0].trim()}
                    </h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
                        {target.score && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#4b5563' }}>
                                <Trophy size={16} color="#ea580c" /> <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{target.score}</span> Puan
                            </div>
                        )}
                        {target.percentile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#4b5563' }}>
                                <Percent size={16} color="#2563eb" /> <span style={{ fontWeight: 'bold', color: '#1f2937' }}>%{target.percentile}</span> Dilim
                            </div>
                        )}
                    </div>
                </div>
              )}

              {/* FLEX YAPISI: SOL (5 Gün + Strateji) | SAĞ (2 Gün) */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>

                  {/* SOL SÜTUN */}
                  <div style={{ flex: 5, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                          {weekDays.map(day => renderPdfDayColumn(day))}
                      </div>

                      {/* Strateji Kutusu */}
                      {advice && (
                        <div style={{ flex: 1, backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '15px', display: 'flex', gap: '12px' }}>
                          <div style={{ marginTop: '2px' }}><Quote size={24} color="#7c3aed" /></div>
                          <div>
                            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#5b21b6', margin: '0 0 6px 0' }}>Haftalık Koç Stratejisi</h2>
                            <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#4c1d95', margin: 0, whiteSpace: 'pre-wrap' }}>{advice}</p>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* SAĞ SÜTUN (HAFTA SONU) */}
                  <div style={{ flex: 2, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      {weekendDays.map(day => renderPdfDayColumn(day, true))}
                  </div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', color: '#9ca3af' }}>DersTakibim.com AI tarafından oluşturulmuştur.</div>
          </div>
      </div>

    </main>
  );
}
