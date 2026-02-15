'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Calendar, ChevronDown, ChevronRight, BookOpen, Hash } from 'lucide-react';

// Tip Tanımları
type RecordDetail = {
  id: string;
  question_count: number;
  subject_name: string;
  topic_name: string | null;
  source_name: string | null;
  note: string | null;
};

type DailyGroup = {
  date: string;
  displayDate: string; // "Bugün", "Dün" veya "12 Şubat Pzt"
  totalQuestions: number;
  records: RecordDetail[];
};

export default function AdminStudentCard({ studentId, studentName }: { studentId: string, studentName: string }) {
  const [dailyGroups, setDailyGroups] = useState<DailyGroup[]>([]);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Hangi günlerin detayı açık? (Varsayılan olarak sadece 'Bugün' açık olsun)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Yardımcı: Tarih Formatlayıcı
  const formatDateLabel = (dateObj: Date, index: number) => {
    if (index === 0) return 'Bugün';
    if (index === 1) return 'Dün';
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }).format(dateObj);
  };

  // Yardımcı: Yerel ISO Tarih (YYYY-MM-DD)
  const toISODate = (d: Date) => {
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!studentId) return;

    (async () => {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6); // Son 7 gün (bugün dahil)

        const startIso = toISODate(sevenDaysAgo);

        // 1. Son 7 Günün Verilerini Çek (Konu ve Kaynak dahil)
        const { data: recentData } = await supabase
            .from('records')
            .select(`
                id,
                question_count,
                activity_date,
                created_at,
                note,
                subjects(name),
                topics(name),
                sources(name)
            `)
            .eq('user_id', studentId)
            .gte('activity_date', startIso) // Son 7 gün
            .not('question_count', 'is', null)
            .order('activity_date', { ascending: false });

        // 2. Genel Toplamı Çek (Tüm zamanlar)
        const { count } = await supabase
            .from('records')
            .select('question_count', { count: 'exact', head: false }) // Sadece count değil sum lazım ama supabase sum vermez, JS ile yaparız veya RPC.
            // Basitlik için tüm id ve countları çekip toplayalım (Veri azsa sorun olmaz)
            .eq('user_id', studentId);

        // Genel toplam için ayrı bir hafif sorgu (Sadece soru sayıları)
        const { data: allCounts } = await supabase
            .from('records')
            .select('question_count')
            .eq('user_id', studentId);

        const total = allCounts?.reduce((acc, r) => acc + (r.question_count || 0), 0) || 0;
        setGrandTotal(total);

        // 3. Veriyi İşle ve Grupla
        const groups: DailyGroup[] = [];
        let weekSum = 0;

        // Son 7 günü döngüye al (Veri olmasa bile listelensin diye)
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateKey = toISODate(d);

            // Bu tarihe ait kayıtları filtrele
            const dayRecords = (recentData || []).filter((r: any) => r.activity_date === dateKey);

            // Günlük Toplam
            const dayTotal = dayRecords.reduce((acc: number, r: any) => acc + (r.question_count || 0), 0);
            weekSum += dayTotal;

            // Kayıtları düzenle
            const processedRecords: RecordDetail[] = dayRecords.map((r: any) => ({
                id: r.id,
                question_count: r.question_count,
                subject_name: r.subjects?.name || 'Ders',
                topic_name: r.topics?.name || null,
                source_name: r.sources?.name || null,
                note: r.note || null
            }));

            groups.push({
                date: dateKey,
                displayDate: formatDateLabel(d, i),
                totalQuestions: dayTotal,
                records: processedRecords
            });
        }

        setDailyGroups(groups);
        setWeeklyTotal(weekSum);

        // Varsayılan olarak sadece 'Bugün'ü aç (Eğer verisi varsa)
        setExpandedDates({ [groups[0].date]: true });

        setLoading(false);
    })();
  }, [studentId]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  if (loading) return <div className="animate-pulse bg-gray-100 h-64 rounded-xl border"></div>;

  return (
    <div className="bg-white border rounded-xl shadow-sm flex flex-col h-[500px]"> {/* Sabit yükseklik veya auto */}

      {/* --- ÜST BİLGİ KARTI --- */}
      <div className="p-4 border-b bg-gray-50 rounded-t-xl">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
                    {studentName.charAt(0)}
                </span>
                {studentName}
            </h3>
            <span className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded border">Son 7 Gün</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white p-2 rounded border shadow-sm flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-semibold">Bu Hafta</span>
                <span className="text-xl font-bold text-emerald-600">{weeklyTotal}</span>
            </div>
            <div className="bg-white p-2 rounded border shadow-sm flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-semibold">Toplam</span>
                <span className="text-xl font-bold text-indigo-600">{grandTotal}</span>
            </div>
        </div>
      </div>

      {/* --- GÜNLÜK LİSTE (Scrollable) --- */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
        {dailyGroups.map((group) => {
            const isOpen = expandedDates[group.date];
            const hasData = group.totalQuestions > 0;

            return (
                <div key={group.date} className={`bg-white border rounded-lg transition-all ${!hasData ? 'opacity-70' : ''}`}>
                    {/* Gün Başlığı */}
                    <button
                        onClick={() => hasData && toggleDate(group.date)}
                        disabled={!hasData}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg"
                    >
                        <div className="flex items-center gap-2">
                            {hasData ? (
                                isOpen ? <ChevronDown size={18} className="text-gray-400"/> : <ChevronRight size={18} className="text-gray-400"/>
                            ) : (
                                <div className="w-[18px]" /> // Boşluk
                            )}
                            <div className="flex flex-col items-start">
                                <span className={`font-semibold text-sm ${group.displayDate === 'Bugün' ? 'text-blue-600' : 'text-gray-700'}`}>
                                    {group.displayDate}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">{group.date}</span>
                            </div>
                        </div>

                        <div className={`px-2 py-1 rounded text-xs font-bold ${hasData ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            {group.totalQuestions} Soru
                        </div>
                    </button>

                    {/* Gün Detayı (Accordion) */}
                    {isOpen && hasData && (
                        <div className="border-t px-3 py-2 bg-gray-50/30 space-y-2">
                            {group.records.map((rec) => (
                                <div key={rec.id} className="flex items-start gap-3 text-sm p-2 bg-white rounded border border-gray-100 shadow-sm">
                                    <div className="mt-1 text-blue-500">
                                        <BookOpen size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-gray-800">{rec.subject_name}</span>
                                            <span className="font-bold text-gray-900 bg-gray-100 px-1.5 rounded text-xs">
                                                {rec.question_count}
                                            </span>
                                        </div>

                                        {/* Konu ve Kaynak Bilgisi */}
                                        <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                                            {rec.topic_name && (
                                                <div className="flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                                                    {rec.topic_name}
                                                </div>
                                            )}
                                            {rec.source_name && (
                                                <div className="flex items-center gap-1 text-gray-400 italic">
                                                    <Hash size={10} />
                                                    {rec.source_name}
                                                    {rec.note && <span className="not-italic text-gray-500 ml-1">({rec.note})</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
}
