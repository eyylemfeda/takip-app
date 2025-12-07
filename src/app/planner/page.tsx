'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
// Web arayüzü için ikonları tutuyoruz
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
  /* PDF İNDİRME FONKSİYONU (ZIRHLI VERSİYON - EMOJI FIX)     */
  /* ======================================================== */
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);

    const element = printRef.current;
    const originalStyle = element.style.cssText;

    try {
      // 1. Görünümü PDF için hazırla
      element.style.width = '1400px';
      element.style.padding = '30px';
      element.style.backgroundColor = '#ffffff';
      element.style.color = '#000000';
      element.style.fontFamily = 'Arial, sans-serif';

      // 2. Fotoğrafı Çek
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1400,
        // SVG klonlamasını devre dışı bırakıp native render zorlayalım (Garanti olsun)
        ignoreElements: (node) => node.nodeName === 'svg'
      });

      // 3. Stili HEMEN eski haline getir
      element.style.cssText = originalStyle;

      // 4. PDF Oluştur
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');

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
      alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      if (printRef.current) printRef.current.style.cssText = originalStyle;
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

      {/* --- YAZDIRILACAK ALAN --- */}
      {/* NOT: Emojiler kullanıldı, SVG ikonlar kaldırıldı. oklch hatası imkansız hale getirildi. */}
      <div
        ref={printRef}
        style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '12px',
            color: '#000000'
        }}
      >

          {/* 1. HEDEF BİLGİSİ */}
          {target && (
            <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '99px',
                                display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                                🎯 HEDEFİM
                            </span>
                        </div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0, lineHeight: 1.2 }}>
                            {target.name.split('(')[0].trim()}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '14px' }}>
                            {target.score && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 8px', borderRadius: '6px',
                                    backgroundColor: '#ffedd5', border: '1px solid #fed7aa', color: '#374151'
                                }}>
                                    <span>🏆</span>
                                    <span style={{ fontWeight: 'bold' }}>{target.score}</span>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', color: '#6b7280' }}>Puan</span>
                                </div>
                            )}
                            {target.percentile && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 8px', borderRadius: '6px',
                                    backgroundColor: '#eff6ff', border: '1px solid #dbeafe', color: '#374151'
                                }}>
                                    <span>📊</span>
                                    <span style={{ fontWeight: 'bold' }}>%{target.percentile}</span>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', color: '#6b7280' }}>Dilim</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {target.motivation && (
                        <div style={{
                            backgroundColor: '#eef2ff',
                            border: '1px solid #e0e7ff',
                            padding: '12px',
                            borderRadius: '8px',
                            maxWidth: '400px',
                            display: 'none' // Mobilde gizli, PDF'te çıkması için genişlik artıyor
                        }} className="hidden md:block">
                            <p style={{ fontSize: '14px', fontStyle: 'italic', fontWeight: '500', color: '#312e81', margin: 0 }}>
                                "{target.motivation}"
                            </p>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* 2. UZMAN GÖRÜŞÜ */}
          {advice && (
            <div style={{
                backgroundColor: '#ffffff',
                borderLeft: '4px solid #6366f1',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '20px', marginTop: '-4px' }}>💬</div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#111827', margin: '0 0 4px 0' }}>
                    Koç Stratejisi
                  </h2>
                  <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {advice}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. PROGRAM GRID */}
          <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px'
          }}>
            {scheduleList.map((dayPlan, idx) => (
              <div key={idx} style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
              }}>
                <div style={{
                    backgroundColor: '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '8px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    fontSize: '12px',
                    color: '#374151'
                }}>
                    {dayPlan.day}
                </div>
                <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dayPlan.blocks.length === 0 ?
                    <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', padding: '8px 0' }}>-</p>
                    :
                    dayPlan.blocks.map((block, bIdx) => {

                    const isBreak = block.type === 'break';
                    let displayActivity = block.activity;
                    // Varsayılan Stil (Ders)
                    let bg = '#eff6ff'; // Mavi
                    let border = '#dbeafe';
                    let text = '#1e3a8a';
                    let weight = '600';
                    let emoji = '📘'; // Ders

                    if (isBreak) {
                        bg = '#f0fdf4'; // Yeşil
                        border = 'transparent';
                        text = '#15803d';
                        displayActivity = getDurationText(block.start, block.end);
                        weight = 'normal';
                        emoji = ''; // Mola
                    } else if (block.type === 'school') {
                        bg = '#fff7ed'; // Turuncu
                        border = '#ffedd5';
                        text = '#9a3412';
                        emoji = '🏫';
                    } else if (block.type === 'course' || block.type === 'bilsem') {
                        bg = '#faf5ff'; // Mor
                        border = '#f3e8ff';
                        text = '#6b21a8';
                        emoji = '📚';
                    } else if (block.type === 'activity') {
                        bg = '#fdf2f8'; // Pembe
                        border = '#fce7f3';
                        text = '#9d174d';
                        emoji = '🎨';
                    }

                    return (
                      <div key={bIdx} style={{
                          backgroundColor: bg,
                          border: `1px solid ${border}`,
                          color: text,
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          minHeight: isBreak ? '20px' : 'auto',
                          justifyContent: isBreak ? 'center' : 'flex-start'
                      }}>
                        {emoji && <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>}
                        <div style={{ flex: 1, textAlign: isBreak ? 'center' : 'left' }}>
                          <div style={{ lineHeight: '1.2', fontWeight: weight }}>{displayActivity}</div>
                          {!isBreak && <div style={{ fontSize: '9px', fontWeight: '500', opacity: 0.7, marginTop: '2px' }}>{block.start}-{block.end}</div>}
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
