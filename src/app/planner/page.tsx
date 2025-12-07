'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
  Calendar, Clock, BookOpen, MapPin, Trash2, Plus, Quote,
  TrendingUp, Target, GraduationCap, School, Coffee, Trophy, Percent
} from 'lucide-react';
import Link from 'next/link';

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
    min_score: number;       // Veritabanındaki isim
    percentile: string;      // Veritabanındaki isim
    estimated_score?: number; // Yedek (Eski kayıtlar için)
    estimated_percentile?: number; // Yedek
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

  const getScheduleList = (): DaySchedule[] => {
    if (!plan || !plan.weekly_schedule) return [];
    if (plan.weekly_schedule.schedule && Array.isArray(plan.weekly_schedule.schedule)) return plan.weekly_schedule.schedule;
    if (Array.isArray(plan.weekly_schedule)) return plan.weekly_schedule;
    return [];
  };

  // SAAT FARKINI HESAPLAYAN YARDIMCI (10 dk Mola yazısı için)
  const getDurationText = (start: string, end: string) => {
    try {
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      return `${diff} dk Mola`;
    } catch (e) {
      return 'Mola';
    }
  };

  const scheduleList = getScheduleList();

  // Tavsiye metnini al ve içinde okul ismi geçiyorsa temizle (Frontend Güvenliği)
  let advice = plan?.weekly_schedule?.expert_advice || "";
  const schoolNameSimple = plan?.target_details?.school_name?.split(' ')[0]; // Örn: "Sırrı"
  if (schoolNameSimple && advice.includes(schoolNameSimple) && advice.length > 50) {
     advice = advice.replace(new RegExp(schoolNameSimple, 'gi'), 'Şampiyon');
  }

  // Target verisini normalize et (Eski ve yeni formatı birleştir)
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

      {/* 1. HEDEF BİLGİSİ (YENİ TASARIM) */}
      {target && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

            {/* SOL TARAF: OKUL ADI VE BİLGİLER */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Target size={12} /> HEDEFİM
                </span>
                </div>

                {/* OKUL ADI (Yuvarlak Hatlı, Temizlenmiş) */}
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight leading-tight">
                {/* Parantez içindeki İlçe/İl bilgisini atıyoruz */}
                {target.name.split('(')[0].trim()}
                </h1>

                {/* PUAN VE YÜZDELİK */}
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

            {/* SAĞ TARAF: MOTİVASYON KUTUSU (Varsa) */}
            {target.motivation && (
                <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-4 rounded-xl max-w-md shadow-sm">
                <p className="text-sm text-indigo-900 italic font-medium leading-relaxed">
                    "{target.motivation}"
                </p>
                </div>
            )}
            </div>
        </div>
      )}

      {/* 2. UZMAN GÖRÜŞÜ */}
      {advice && (
        <div className="bg-white p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Quote size={80} />
          </div>
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-2 bg-indigo-100 rounded-full text-indigo-600 shrink-0 mt-1">
              <Quote size={20} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">Haftalık Koç Stratejisi</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {advice}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. PROGRAM BAŞLIK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-2">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-blue-600" /> Haftalık Programım
        </h2>
        <div className="flex gap-2">
          <Link href="/planner/create" className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Yeniden Oluştur</Link>
          <button onClick={deletePlan} className="px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2 border border-red-100"><Trash2 size={16} /> Sil</button>
        </div>
      </div>

      {/* 4. PROGRAM GRID */}
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
                    // Minimal Mola
                    colorClass = "bg-green-50/50 border-green-100/50 text-green-700/70 text-xs border-0 justify-center";
                    icon = <Coffee size={12} className="hidden" />;
                    displayActivity = getDurationText(block.start, block.end);
                    displayTime = "";
                } else if (block.type === 'lesson') {
                    // Dersler (Matematik vb.)
                    colorClass = "bg-blue-50 border-blue-100 text-blue-900 shadow-sm";
                    icon = <BookOpen size={14} className="text-blue-500" />;
                }
                else if (block.type === 'school') { colorClass = "bg-orange-50 border-orange-100 text-orange-900"; icon = <School size={14} className="text-orange-500" />; }
                else if (block.type === 'course' || block.type === 'bilsem') { colorClass = "bg-purple-50 border-purple-100 text-purple-900"; icon = <MapPin size={14} className="text-purple-500" />; }
                else if (block.type === 'activity') { colorClass = "bg-pink-50 border-pink-100 text-pink-900"; icon = <Clock size={14} className="text-pink-500" />; }

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
    </main>
  );
}
