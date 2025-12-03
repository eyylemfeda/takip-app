'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, BookOpen, MapPin, Trash2, Plus, Quote, TrendingUp, Target, GraduationCap, School, Coffee } from 'lucide-react';
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
    estimated_score: number;
    estimated_percentile: number;
    difficulty_level: string;
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
  const advice = plan?.weekly_schedule?.expert_advice;
  const target = plan?.target_details;

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

      {/* 1. HEDEF BİLGİSİ */}
      {target && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Target size={14} /> Hedefim
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 uppercase tracking-tight mb-4">
            {target.school_name}
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 text-lg">
            <div className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
              <div className="p-2 bg-green-100 rounded-full text-green-700"><TrendingUp size={20} /></div>
              <div className="text-left">
                <p className="text-xs text-gray-500 font-medium uppercase">Taban Puan</p>
                <p className="font-bold text-gray-900 leading-none">{target.estimated_score}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
              <div className="p-2 bg-purple-100 rounded-full text-purple-700"><GraduationCap size={20} /></div>
              <div className="text-left">
                <p className="text-xs text-gray-500 font-medium uppercase">Yüzdelik Dilim</p>
                <p className="font-bold text-gray-900 leading-none">%{target.estimated_percentile}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. UZMAN GÖRÜŞÜ */}
      {advice && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 shadow-sm relative">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600 shrink-0">
              <Quote size={24} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-indigo-900">Haftalık Koç Stratejisi</h2>
              <p className="text-gray-800 italic leading-relaxed whitespace-pre-wrap">
                {advice}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. PROGRAM BAŞLIK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-blue-600" /> Haftalık Programım
        </h2>
        <div className="flex gap-2">
          <Link href="/planner/create" className="px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">Yeni Program</Link>
          <button onClick={deletePlan} className="px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2"><Trash2 size={16} /> Sil</button>
        </div>
      </div>

      {/* 4. PROGRAM GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {scheduleList.map((dayPlan, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-gray-50 p-3 border-b font-bold text-gray-700 text-center">{dayPlan.day}</div>
            <div className="p-2 space-y-1 flex-1">
              {dayPlan.blocks.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Boş gün 🎉</p> : dayPlan.blocks.map((block, bIdx) => {

                const isBreak = block.type === 'break';
                let colorClass = "bg-gray-50 border-gray-100 text-gray-600";
                let icon = <Clock size={14} />;

                // Mola Metni: Eğer "Mola" ise saat yerine "10 dk Mola" yaz
                let displayActivity = block.activity;
                let displayTime = `${block.start} - ${block.end}`;

                if (isBreak) {
                   // Minimal Mola Stili
                   colorClass = "bg-green-50/30 border-green-100/50 text-green-600/80 text-xs border-0 justify-center";
                   icon = <Coffee size={12} className="hidden" />; // İkonu gizle, sadece yazı ortada dursun
                   displayActivity = getDurationText(block.start, block.end); // "10 dk Mola"
                   displayTime = ""; // Saati gizle
                } else if (block.type === 'lesson') {
                   colorClass = "bg-blue-50 border-blue-100 text-blue-800 py-2";
                   icon = <BookOpen size={14} />;
                }
                else if (block.type === 'school') { colorClass = "bg-orange-50 border-orange-100 text-orange-800 py-2"; icon = <School size={14} />; }
                else if (block.type === 'course' || block.type === 'bilsem') { colorClass = "bg-purple-50 border-purple-100 text-purple-800 py-2"; icon = <MapPin size={14} />; }
                else if (block.type === 'activity') { colorClass = "bg-pink-50 border-pink-100 text-pink-800 py-2"; icon = <Clock size={14} />; }

                return (
                  <div key={bIdx} className={`px-2 rounded-lg border text-sm flex gap-2 items-center ${colorClass} ${isBreak ? 'h-6 min-h-0' : ''}`}>
                    {!isBreak && <div className="opacity-70 shrink-0">{icon}</div>}
                    <div className={`flex-1 ${isBreak ? 'text-center font-medium' : ''}`}>
                      <div className={isBreak ? '' : 'font-semibold'}>{displayActivity}</div>
                      {!isBreak && <div className="text-xs opacity-80">{displayTime}</div>}
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
