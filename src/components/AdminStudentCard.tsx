'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#14B8A6','#F97316'];

export default function AdminStudentCard({ studentId, studentName }: { studentId: string, studentName: string }) {
  const [todayRecs, setTodayRecs] = useState<any[]>([]);
  const [allRecs, setAllRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tarih yardımcıları
  const todayLocalISODate = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!studentId) return;
    (async () => {
        const dayKey = todayLocalISODate();

        // 1. Bugünün Verileri
        const { data: todayData } = await supabase
            .from('records')
            .select(`id, question_count, subjects(name), topics(name)`)
            .eq('user_id', studentId)
            .eq('activity_date', dayKey)
            .not('question_count', 'is', null);

        // 2. Haftalık/Toplam Veriler
        const { data: allData } = await supabase
            .from('records')
            .select(`id, question_count, created_at, activity_date`)
            .eq('user_id', studentId)
            .not('question_count', 'is', null);

        setTodayRecs(todayData || []);
        setAllRecs(allData || []);
        setLoading(false);
    })();
  }, [studentId]);

  // Hesaplamalar
  const todayTotal = todayRecs.reduce((acc, r) => acc + (r.question_count || 0), 0);

  const weeklyTotal = useMemo(() => {
      const startOfWeek = new Date();
      startOfWeek.setHours(0,0,0,0);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day == 0 ? -6 : 1);
      startOfWeek.setDate(diff); // Pazartesi

      return allRecs.reduce((acc, r) => {
          const d = r.activity_date ? new Date(r.activity_date) : new Date(r.created_at);
          return d >= startOfWeek ? acc + (r.question_count || 0) : acc;
      }, 0);
  }, [allRecs]);

  const totalTotal = allRecs.reduce((acc, r) => acc + (r.question_count || 0), 0);

  // Pasta Grafiği Verisi
  const pieData = useMemo(() => {
    const m: Record<string, number> = {};
    todayRecs.forEach(r => {
        const name = r.subjects?.name || 'Diğer';
        m[name] = (m[name] || 0) + (r.question_count || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [todayRecs]);

  if (loading) return <div className="animate-pulse bg-gray-100 h-40 rounded-lg"></div>;

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 flex flex-col h-full">
      <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-2 flex justify-between">
        <span>{studentName}</span>
        <span className="text-emerald-600 bg-emerald-50 px-2 rounded text-sm flex items-center">
            Bugün: {todayTotal} Soru
        </span>
      </h3>

      <div className="flex flex-row gap-2 h-full">
        {/* Sol: Liste */}
        <div className="flex-1 space-y-2 text-sm overflow-y-auto max-h-40">
            {pieData.length === 0 ? (
                <p className="text-gray-400 text-xs italic p-2">Bugün henüz veri girişi yok.</p>
            ) : (
                pieData.map((d, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-1">
                        <span className="font-medium text-gray-600">{d.name}</span>
                        <span className="font-bold text-gray-800">{d.value}</span>
                    </div>
                ))
            )}
        </div>

        {/* Sağ: Grafik */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0">
            {pieData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} dataKey="value" outerRadius="90%" innerRadius="40%" paddingAngle={2}>
                            {pieData.map((d, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Alt Özetler */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:text-sm">
          <div className="bg-blue-50 text-blue-700 rounded p-1 font-semibold">
             Haftalık: {weeklyTotal}
          </div>
          <div className="bg-purple-50 text-purple-700 rounded p-1 font-semibold">
             Toplam: {totalTotal}
          </div>
      </div>
    </div>
  );
}
