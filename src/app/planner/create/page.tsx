'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  ChevronRight, School, Trophy, Brain, BookOpen, Atom, Plus, Trash2,
  Palette, Clock, CheckCircle2, Zap, Settings, Coffee, Sun, Moon, Book, Calendar
} from 'lucide-react';

/* ========= TİPLER ========= */

export type TimeBlock = {
  id: string;
  name: string;
  day: string;
  start: string;
  end: string;
  type?: 'lesson' | 'activity' | 'break';
};

export type PlannerData = {
  targetType: 'school' | 'score';
  targetSchoolName: string;
  targetScore: string;
  targetPercentile: string;
  schoolStartTime: string;
  schoolEndTime: string;
  workEndTime: string;
  sleepTime: string;
  readBookBeforeSleep: boolean;
  hasWeekdayCourse: boolean;
  weekdayCourseStart: string;
  weekdayCourseEnd: string;
  hasSaturdayCourse: boolean;
  saturdayCourseStart: string;
  saturdayCourseEnd: string;
  hasSundayCourse: boolean;
  sundayCourseStart: string;
  sundayCourseEnd: string;
  goesToBilsem: boolean;
  bilsemDays: string[];
  bilsemStart: string;
  bilsemEnd: string;
  privateLessons: TimeBlock[];
  socialActivities: TimeBlock[];
  breaks: TimeBlock[];
  wantsMorningStudy: boolean;
  morningDays: string[];
  morningStart: string;
  morningEnd: string;
  difficultSubjects: string[];
  studyTempo: string;
  subjectFrequencies: Record<string, number>;
};

const INITIAL_DATA: PlannerData = {
  targetType: 'school',
  targetSchoolName: '',
  targetScore: '',
  targetPercentile: '',
  schoolStartTime: '08:40',
  schoolEndTime: '15:45',
  workEndTime: '21:30',
  sleepTime: '23:00',
  readBookBeforeSleep: true,
  hasWeekdayCourse: false,
  weekdayCourseStart: '16:00',
  weekdayCourseEnd: '19:00',
  hasSaturdayCourse: false,
  saturdayCourseStart: '09:00',
  saturdayCourseEnd: '13:00',
  hasSundayCourse: false,
  sundayCourseStart: '09:00',
  sundayCourseEnd: '13:00',
  goesToBilsem: false,
  bilsemDays: [],
  bilsemStart: '14:00',
  bilsemEnd: '18:00',
  privateLessons: [],
  socialActivities: [],
  breaks: [],
  wantsMorningStudy: false,
  morningDays: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'],
  morningStart: '06:00',
  morningEnd: '07:30',
  difficultSubjects: [],
  studyTempo: '40+10',
  subjectFrequencies: {
    'Türkçe': 4,
    'Matematik': 4,
    'Fen Bilimleri': 4,
    'T.C. İnkılap Tarihi': 2,
    'İngilizce': 2,
    'Din Kültürü': 2
  }
};

export default function CreatePlannerPage() {
  const { loading, session } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PlannerData>(INITIAL_DATA);

  // YENİ: Yükleme durumu için state
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const updateData = (fields: Partial<PlannerData>) => {
    setFormData(prev => ({ ...prev, ...fields }));
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // SON ADIM: VERİYİ GÖNDERME
  const finishWizard = async () => {
    if (!session?.access_token) {
      alert("Oturum süresi dolmuş veya giriş yapılmamış. Lütfen sayfayı yenileyip tekrar giriş yapın.");
      return;
    }

    const confirmMsg = `Veriler toplandı!\n\nHedef: ${formData.targetSchoolName || formData.targetScore}\nTempo: ${formData.studyTempo}\n\nYapay Zeka programını hazırlamaya başlıyor.`;

    if (!confirm(confirmMsg)) return;

    // YÜKLEMEYİ BAŞLAT
    setIsLoading(true);

    try {
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ formData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Bir hata oluştu');
      }

      // Başarılı olursa yönlendir (Yükleme ekranı dönmeye devam ederken sayfa değişir)
      router.push('/planner');

    } catch (error: any) {
      console.error(error);
      alert("Hata: " + error.message);
      setIsLoading(false); // Hata durumunda yüklemeyi kapat
    }
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 relative">

      {/* BAŞLIK & İLERLEME */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">
          {step === 1 && 'Hedefini Belirle 🎯'}
          {step === 2 && 'Zaman Yönetimi ⏰'}
          {step === 3 && 'Rutinler & Aktiviteler 📅'}
          {step === 4 && 'Çalışma Tarzı 🧠'}
        </h1>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">Adım {step} / 4</p>
      </div>

      {/* ADIM İÇERİKLERİ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        {step === 1 && <Step1Target data={formData} update={updateData} onNext={nextStep} />}
        {step === 2 && <Step2Time data={formData} update={updateData} onNext={nextStep} onBack={prevStep} />}
        {step === 3 && <Step3Activities data={formData} update={updateData} onNext={nextStep} onBack={prevStep} />}
        {step === 4 && <Step4Style data={formData} update={updateData} onFinish={finishWizard} onBack={prevStep} />}
      </div>

      {/* ========================================================= */}
      {/* YÜKLEME EKRANI (OVERLAY)               */}
      {/* ========================================================= */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center animate-in zoom-in duration-300 border border-gray-100">

            {/* Animasyonlu İkon */}
            <div className="relative mb-6">
              {/* Dönen Dış Halka */}
              <div className="w-24 h-24 border-[6px] border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              {/* Ortadaki Pulsing Beyin */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain size={40} className="text-blue-600 animate-pulse" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Yapay Zeka Çalışıyor...
            </h3>

            <div className="space-y-2 text-sm text-gray-500">
              <p>Hedeflerini analiz ediyorum.</p>
              <p>Ders programını dengeliyorum.</p>
              <p>Sana özel rotayı çiziyorum.</p>
            </div>

            <div className="mt-6 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs font-semibold border border-blue-100">
              ⏳ Bu işlem yaklaşık 1-2 dakika sürebilir.<br/>
              Lütfen sayfayı kapatma.
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

// ... (Step1Target, Step2Time, Step3Activities ve Step4Style bileşenleri AYNEN KALACAK -
// Önceki kodunuzdan kopyaladığınız alt kısımları buraya eklemeyi unutmayın veya mevcut dosyanın sadece üst kısmını değiştirin)
/* ============================================== */
/* ADIM 1: HEDEF (AKILLI & DETAYLI OKUL ARAMA)    */
/* ============================================== */
function Step1Target({ data, update, onNext }: { data: PlannerData; update: (f: Partial<PlannerData>) => void; onNext: () => void }) {

  // Supabase bağlantısı (Standart kütüphane ile)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Okul Arama Fonksiyonu
  const searchSchool = async (query: string) => {
    update({ targetSchoolName: query });

    // 3 harften azsa arama yapma
    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    // Hem OKUL ADINDA hem de İLÇEDE arama yap (Karesi, Sırrı vb.)
    const { data: schools, error } = await supabase
      .from('high_schools')
      .select('*')
      .or(`name.ilike.%${query}%,district.ilike.%${query}%`)
      .limit(10); // Çok şişmesin diye 10 tane getiriyoruz

    if (!error && schools && schools.length > 0) {
      setSearchResults(schools);
      setShowResults(true);
    } else {
      setSearchResults([]);
    }

    setIsSearching(false);
  };

  // Okul Seçildiğinde Çalışacak Fonksiyon
  const selectSchool = (school: any) => {
    // Okul adını daha detaylı kaydedelim: "Okul Adı (İlçe/Şehir)" formatında
    // Böylece yapay zeka okulun nerede olduğunu da anlar.
    const fullName = `${school.name} (${school.district}/${school.city})`;

    update({
      targetSchoolName: fullName,
      // Veritabanındaki sayısal veriyi string'e çevirip inputlara basıyoruz
      targetScore: school.min_score ? school.min_score.toString() : '',
      targetPercentile: school.percentile ? school.percentile.toString() : '',
    });
    setShowResults(false);
  };

  // Validasyonlar ve Helperlar
  const isValid = (data.targetType === 'school' && data.targetSchoolName.length > 2) || (data.targetType === 'score' && data.targetScore.length >= 3);
  const handleNumberInput = (val: string, field: 'targetScore' | 'targetPercentile') => { if (!/^[0-9.,]*$/.test(val)) return; update({ [field]: val.replace(',', '.') }); };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

      {/* BAŞLIK */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-800">Hedefin ne?</h2>
        <p className="text-sm text-gray-500">Listeden okul seçersen puanlar otomatik dolar.</p>
      </div>

      {/* TİP SEÇİMİ BUTONLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => update({ targetType: 'school' })} className={`p-4 rounded-xl border-2 text-left transition-all ${data.targetType === 'school' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300'}`}><div className="flex items-center gap-3 mb-2"><School className={data.targetType === 'school' ? 'text-blue-600' : 'text-gray-400'} size={24} /><span className="font-semibold">Lise Hedefim Var</span></div><p className="text-xs text-gray-500">Spesifik bir okul hedefliyorum.</p></button>
        <button onClick={() => update({ targetType: 'score' })} className={`p-4 rounded-xl border-2 text-left transition-all ${data.targetType === 'score' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300'}`}><div className="flex items-center gap-3 mb-2"><Trophy className={data.targetType === 'score' ? 'text-purple-600' : 'text-gray-400'} size={24} /><span className="font-semibold">Puan Hedefim Var</span></div><p className="text-xs text-gray-500">Puan veya yüzdelik hedefim var.</p></button>
      </div>

      <hr className="border-gray-100" />

      {/* FORM ALANLARI */}
      <div className="space-y-4">

        {/* OKUL ARAMA KUTUSU */}
        {data.targetType === 'school' && (
          <div className="relative group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Okul Adı</label>
            <div className="relative">
              <input
                type="text"
                value={data.targetSchoolName}
                onChange={(e) => searchSchool(e.target.value)}
                onFocus={() => { if(data.targetSchoolName.length > 2) setShowResults(true); }}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder="Okul adı veya İlçe yaz (Örn: Karesi)..."
                className="w-full p-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
              <School className="absolute left-3 top-3.5 text-gray-400" size={18} />

              {isSearching && (
                <div className="absolute right-3 top-3.5 animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
              )}
            </div>

            {/* ARAMA SONUÇLARI LİSTESİ */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto ring-1 ring-black ring-opacity-5">
                {searchResults.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => selectSchool(school)}
                    className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        {/* Okul Adı */}
                        <div className="font-semibold text-gray-800 group-hover:text-blue-700">
                          {school.name}
                        </div>
                        {/* Detaylar: İlçe/İl - Tip */}
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2 items-center">
                           <span>{school.district} / {school.city}</span>
                           <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                           <span className="text-gray-600 font-medium">{school.type}</span>
                        </div>
                        {/* Varsa Yabancı Dil */}
                        {school.language && (
                           <div className="text-[10px] text-gray-400 mt-0.5">Dil: {school.language}</div>
                        )}
                      </div>

                      {/* Sağ Taraf: Puan ve Yüzdelik */}
                      <div className="text-right min-w-[70px]">
                        {school.min_score ? (
                          <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap inline-block">
                            {Number(school.min_score).toFixed(2)}
                          </div>
                        ) : (
                           <div className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] whitespace-nowrap">Puansız</div>
                        )}
                        {school.percentile && (
                          <div className="text-xs text-blue-600 mt-1 font-medium whitespace-nowrap">
                            %{school.percentile}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* SONUÇ BULUNAMADI UYARISI */}
            {showResults && !isSearching && searchResults.length === 0 && data.targetSchoolName.length > 3 && (
                 <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
                    Sonuç bulunamadı. İlçe veya okul adını kontrol et.
                 </div>
            )}
          </div>
        )}

        {/* PUAN INPUTLARI (Otomatik dolsa da elle değiştirilebilir) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Puan</label>
            <input type="text" inputMode="decimal" value={data.targetScore} onChange={(e) => handleNumberInput(e.target.value, 'targetScore')} placeholder="Örn: 485" className={`w-full p-3 rounded-lg border focus:ring-2 outline-none transition-all ${data.targetScore ? 'bg-green-50 border-green-200 focus:ring-green-500' : 'border-gray-300 focus:ring-blue-500'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Yüzdelik</label>
            <div className="relative">
              <input type="text" inputMode="decimal" value={data.targetPercentile} onChange={(e) => handleNumberInput(e.target.value, 'targetPercentile')} placeholder="Örn: 0,5" className={`w-full p-3 rounded-lg border focus:ring-2 outline-none pl-8 transition-all ${data.targetPercentile ? 'bg-green-50 border-green-200 focus:ring-green-500' : 'border-gray-300 focus:ring-blue-500'}`} />
              <span className="absolute left-3 top-3.5 text-gray-400 font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* İLERLEME BUTONU */}
      <div className="pt-4 flex justify-end">
        <button onClick={onNext} disabled={!isValid} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95">
          Sonraki: Zaman <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}


/* ============================================== */
/* ADIM 2: ZAMAN                                  */
/* ============================================== */
function Step2Time({ data, update, onNext, onBack }: { data: PlannerData; update: (f: Partial<PlannerData>) => void; onNext: () => void; onBack: () => void; }) {
  const isSchoolValid = data.schoolEndTime > data.schoolStartTime;
  const isWeekdayCourseValid = !data.hasWeekdayCourse || (data.weekdayCourseEnd > data.weekdayCourseStart);
  const isSatValid = !data.hasSaturdayCourse || (data.saturdayCourseEnd > data.saturdayCourseStart);
  const isSunValid = !data.hasSundayCourse || (data.sundayCourseEnd > data.sundayCourseStart);
  const isBilsemValid = !data.goesToBilsem || (data.bilsemEnd > data.bilsemStart && data.bilsemDays.length > 0);

  // YENİ: Çalışma ve Uyku saatleri validasyonu
  const isSleepValid = data.sleepTime > data.workEndTime;

  const isValid = isSchoolValid && isWeekdayCourseValid && isSatValid && isSunValid && isBilsemValid;
  const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const toggleBilsemDay = (day: string) => { const current = data.bilsemDays; if (current.includes(day)) { update({ bilsemDays: current.filter(d => d !== day) }); } else { update({ bilsemDays: [...current, day] }); } };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1"><h2 className="text-lg font-semibold text-gray-800">Okul ve Kurs Saatlerin</h2><p className="text-sm text-gray-500">Bu zorunlu saatleri bilmemiz, boş zamanlarını planlamamız için kritik.</p></div>

      {/* 1. OKUL */}
      <div className="p-5 bg-blue-50 rounded-xl border border-blue-100 space-y-4"><div className="flex items-center gap-2 text-blue-800 font-medium"><School size={20} /><h3>Hafta İçi Okul</h3></div><div className="grid grid-cols-2 gap-6"><div><label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label><input type="time" value={data.schoolStartTime} onChange={(e) => update({ schoolStartTime: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label><input type="time" value={data.schoolEndTime} onChange={(e) => update({ schoolEndTime: e.target.value })} className={`w-full p-3 bg-white rounded-lg border focus:ring-2 outline-none cursor-pointer ${!isSchoolValid ? 'border-red-500 ring-red-200' : 'border-gray-200 focus:ring-blue-500'}`} /></div></div>{!isSchoolValid && <p className="text-xs text-red-600">Okul çıkış saati, başlangıçtan önce olamaz.</p>}</div>

      {/* 2. DERSHANE */}
      <div className={`p-5 rounded-xl border transition-all duration-300 ${data.hasWeekdayCourse ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2 font-medium text-gray-800"><BookOpen size={20} className={data.hasWeekdayCourse ? 'text-indigo-600' : 'text-gray-400'} /><h3>Hafta İçi Kurs / Dershane / Etüt</h3></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={data.hasWeekdayCourse} onChange={(e) => update({ hasWeekdayCourse: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div></label></div>{data.hasWeekdayCourse && (<div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2"><div><label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label><input type="time" value={data.weekdayCourseStart} onChange={(e) => update({ weekdayCourseStart: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label><input type="time" value={data.weekdayCourseEnd} onChange={(e) => update({ weekdayCourseEnd: e.target.value })} className={`w-full p-3 bg-white rounded-lg border focus:ring-2 outline-none cursor-pointer ${!isWeekdayCourseValid ? 'border-red-500 ring-red-200' : 'border-gray-200 focus:ring-indigo-500'}`} /></div></div>)}</div>

      {/* 3. CUMARTESİ */}
      <div className={`p-5 rounded-xl border transition-all duration-300 ${data.hasSaturdayCourse ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2 font-medium text-gray-800"><Brain size={20} className={data.hasSaturdayCourse ? 'text-orange-600' : 'text-gray-400'} /><h3>Cumartesi Kurs / Dershane / Etüt</h3></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={data.hasSaturdayCourse} onChange={(e) => update({ hasSaturdayCourse: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div></label></div>{data.hasSaturdayCourse && (<div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2"><div><label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label><input type="time" value={data.saturdayCourseStart} onChange={(e) => update({ saturdayCourseStart: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label><input type="time" value={data.saturdayCourseEnd} onChange={(e) => update({ saturdayCourseEnd: e.target.value })} className={`w-full p-3 bg-white rounded-lg border focus:ring-2 outline-none cursor-pointer ${!isSatValid ? 'border-red-500 ring-red-200' : 'border-gray-200 focus:ring-orange-500'}`} /></div></div>)}{data.hasSaturdayCourse && !isSatValid && <p className="text-xs text-red-600 mt-2">Hata: Bitiş saati başlangıçtan önce olamaz.</p>}</div>

      {/* 4. PAZAR */}
      <div className={`p-5 rounded-xl border transition-all duration-300 ${data.hasSundayCourse ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2 font-medium text-gray-800"><Brain size={20} className={data.hasSundayCourse ? 'text-orange-600' : 'text-gray-400'} /><h3>Pazar Kurs / Dershane / Etüt</h3></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={data.hasSundayCourse} onChange={(e) => update({ hasSundayCourse: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div></label></div>{data.hasSundayCourse && (<div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2"><div><label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label><input type="time" value={data.sundayCourseStart} onChange={(e) => update({ sundayCourseStart: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label><input type="time" value={data.sundayCourseEnd} onChange={(e) => update({ sundayCourseEnd: e.target.value })} className={`w-full p-3 bg-white rounded-lg border focus:ring-2 outline-none cursor-pointer ${!isSunValid ? 'border-red-500 ring-red-200' : 'border-gray-200 focus:ring-orange-500'}`} /></div></div>)}{data.hasSundayCourse && !isSunValid && <p className="text-xs text-red-600 mt-2">Hata: Bitiş saati başlangıçtan önce olamaz.</p>}</div>

      {/* 5. BİLSEM */}
      <div className={`p-5 rounded-xl border transition-all duration-300 ${data.goesToBilsem ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2 font-medium text-gray-800"><Atom size={20} className={data.goesToBilsem ? 'text-purple-600' : 'text-gray-400'} /><div><h3>BİLSEM</h3><p className="text-xs text-gray-500 font-normal">Bilim ve Sanat Merkezi</p></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={data.goesToBilsem} onChange={(e) => update({ goesToBilsem: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div></label></div>{data.goesToBilsem && (<div className="space-y-4 animate-in slide-in-from-top-2"><div><label className="block text-xs font-medium text-gray-500 mb-2">Hangi günler gidiyorsun?</label><div className="flex flex-wrap gap-2">{DAYS.map(day => (<button key={day} onClick={() => toggleBilsemDay(day)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${data.bilsemDays.includes(day) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>{day}</button>))}</div>{data.bilsemDays.length === 0 && <p className="text-xs text-red-500 mt-1">En az bir gün seçmelisin.</p>}</div><div className="grid grid-cols-2 gap-6"><div><label className="block text-xs font-medium text-gray-500 mb-1">Servise Biniş</label><input type="time" value={data.bilsemStart} onChange={(e) => update({ bilsemStart: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Eve Dönüş</label><input type="time" value={data.bilsemEnd} onChange={(e) => update({ bilsemEnd: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer" /></div></div><p className="text-xs text-purple-600 italic">* Lütfen yol (servis) sürelerini dahil ederek saatleri giriniz.</p></div>)}</div>

      {/* 6. ÇALIŞMA BİTİŞ & UYKU */}
      <div className="p-5 bg-indigo-900 text-white rounded-xl border border-indigo-800 space-y-4 shadow-md">
        <div className="flex items-center gap-2 font-medium text-indigo-100">
          <Moon size={20} />
          <h3>Gece Rutini</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-indigo-300 mb-1">Çalışma Bitiş</label>
            <input
              type="time"
              value={data.workEndTime}
              onChange={(e) => update({ workEndTime: e.target.value })}
              className="w-full p-3 bg-indigo-800 rounded-lg border border-indigo-700 focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-indigo-300 mb-1">Uyku Saati</label>
            <input
              type="time"
              value={data.sleepTime}
              onChange={(e) => update({ sleepTime: e.target.value })}
              className="w-full p-3 bg-indigo-800 rounded-lg border border-indigo-700 focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer text-white"
            />
          </div>
        </div>

        {/* Kitap Okuma Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-indigo-800">
          <div className="flex items-center gap-2 text-sm text-indigo-200">
            <Book size={18} />
            <span>Uyumadan önce 30dk Kitap Okuma</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.readBookBeforeSleep}
              onChange={(e) => update({ readBookBeforeSleep: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-indigo-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          </label>
        </div>
      </div>

      <div className="pt-4 flex justify-between"><button onClick={onBack} className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">Geri</button><button onClick={onNext} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all active:scale-95">Sonraki: Aktiviteler<ChevronRight size={20} /></button></div>
    </div>
  );
}

/* ============================================== */
/* ADIM 3: RUTİNLER & AKTİVİTELER                 */
/* ============================================== */
function Step3Activities({
  data,
  update,
  onNext,
  onBack
}: {
  data: PlannerData;
  update: (f: Partial<PlannerData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  const [newLesson, setNewLesson] = useState({ name: '', day: 'Pazartesi', start: '18:00', end: '19:00' });
  const [newActivity, setNewActivity] = useState({ name: '', day: 'Pazartesi', start: '16:00', end: '17:00' });
  const [newBreak, setNewBreak] = useState({ name: '', frequency: 'Her Gün' as any, day: 'Pazartesi', start: '19:00', end: '20:00' });

  const addLesson = () => { if (!newLesson.name) return; update({ privateLessons: [...data.privateLessons, { id: Math.random().toString(36).substr(2, 9), ...newLesson, type: 'lesson' }] }); setNewLesson({ ...newLesson, name: '' }); };
  const addActivity = () => { if (!newActivity.name) return; update({ socialActivities: [...data.socialActivities, { id: Math.random().toString(36).substr(2, 9), ...newActivity, type: 'activity' }] }); setNewActivity({ ...newActivity, name: '' }); };
  const addBreak = () => {
    if (!newBreak.name) return;
    let daysToAdd: string[] = [];
    if (newBreak.frequency === 'Belirli Gün') daysToAdd = [newBreak.day];
    else if (newBreak.frequency === 'Hafta İçi') daysToAdd = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    else if (newBreak.frequency === 'Hafta Sonu') daysToAdd = ['Cumartesi', 'Pazar'];
    else if (newBreak.frequency === 'Her Gün') daysToAdd = DAYS;
    const newBlocks = daysToAdd.map(day => ({ id: Math.random().toString(36).substr(2, 9), name: newBreak.name, day: day, start: newBreak.start, end: newBreak.end, type: 'break' as const }));
    update({ breaks: [...data.breaks, ...newBlocks] }); setNewBreak({ ...newBreak, name: '' });
  };
  const removeLesson = (id: string) => update({ privateLessons: data.privateLessons.filter(i => i.id !== id) });
  const removeActivity = (id: string) => update({ socialActivities: data.socialActivities.filter(i => i.id !== id) });
  const removeBreak = (id: string) => update({ breaks: data.breaks.filter(i => i.id !== id) });
  const toggleMorningDay = (day: string) => { const current = data.morningDays; if (current.includes(day)) update({ morningDays: current.filter(d => d !== day) }); else update({ morningDays: [...current, day] }); };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1"><h2 className="text-lg font-semibold text-gray-800">Rutinler & Aktiviteler</h2><p className="text-sm text-gray-500">Bu saatleri "dolu" olarak işaretleyeceğiz.</p></div>
      {/* 1. SABAH ERKEN ÇALIŞMA */}
      <div className={`p-5 rounded-xl border transition-all duration-300 ${data.wantsMorningStudy ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-200'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2 font-medium text-gray-800"><Sun size={20} className={data.wantsMorningStudy ? 'text-yellow-600' : 'text-gray-400'} /><div><h3>Sabah Erken Çalışma</h3><p className="text-xs text-gray-500 font-normal">Okuldan önce zihnin açıkken çalışmak ister misin?</p></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={data.wantsMorningStudy} onChange={(e) => update({ wantsMorningStudy: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div></label></div>{data.wantsMorningStudy && (<div className="space-y-4 animate-in slide-in-from-top-2"><div><label className="block text-xs font-medium text-gray-500 mb-2">Hangi günler?</label><div className="flex flex-wrap gap-2">{DAYS.map(day => (<button key={day} onClick={() => toggleMorningDay(day)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${data.morningDays.includes(day) ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'}`}>{day}</button>))}</div></div><div className="grid grid-cols-2 gap-6"><div><label className="block text-xs font-medium text-gray-500 mb-1">Uyanış / Başla</label><input type="time" value={data.morningStart} onChange={(e) => update({ morningStart: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-yellow-500 outline-none cursor-pointer" /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label><input type="time" value={data.morningEnd} onChange={(e) => update({ morningEnd: e.target.value })} className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-yellow-500 outline-none cursor-pointer" /></div></div><p className="text-xs text-yellow-700 italic">* Yapay zeka bu saatlere en verimli dersleri koyacaktır.</p></div>)}</div>
      {/* 2. YEMEK & DİNLENME */}
      <div className="p-5 bg-orange-50 rounded-xl border border-orange-100 space-y-4"><div className="flex items-center gap-2 text-orange-800 font-medium"><Coffee size={20} /><h3>Yemek & Dinlenme ve Diğer Molalar</h3></div><div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"><div className="sm:col-span-3"><label className="block text-xs font-medium text-gray-500 mb-1">Adı</label><input type="text" value={newBreak.name} onChange={e => setNewBreak({...newBreak, name: e.target.value})} className="w-full p-2 rounded border border-orange-200 text-sm" placeholder="Mola Adı Girin" /></div><div className="sm:col-span-3"><label className="block text-xs font-medium text-gray-500 mb-1">Sıklık</label><select value={newBreak.frequency} onChange={e => setNewBreak({...newBreak, frequency: e.target.value as any})} className="w-full p-2 rounded border border-orange-200 text-sm bg-white"><option value="Her Gün">Her Gün</option><option value="Hafta İçi">Hafta İçi</option><option value="Hafta Sonu">Hafta Sonu</option><option value="Belirli Gün">Belirli Gün</option></select></div>{newBreak.frequency === 'Belirli Gün' && (<div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Gün</label><select value={newBreak.day} onChange={e => setNewBreak({...newBreak, day: e.target.value})} className="w-full p-2 rounded border border-orange-200 text-sm bg-white">{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>)}<div className={newBreak.frequency === 'Belirli Gün' ? "sm:col-span-2" : "sm:col-span-3"}><label className="block text-xs font-medium text-gray-500 mb-1">Başla</label><input type="time" value={newBreak.start} onChange={e => setNewBreak({...newBreak, start: e.target.value})} className="w-full p-2 rounded border border-orange-200 text-sm" /></div><div className={newBreak.frequency === 'Belirli Gün' ? "sm:col-span-1" : "sm:col-span-2"}><label className="block text-xs font-medium text-gray-500 mb-1">Bitir</label><input type="time" value={newBreak.end} onChange={e => setNewBreak({...newBreak, end: e.target.value})} className="w-full p-2 rounded border border-orange-200 text-sm" /></div><div className="sm:col-span-1"><button onClick={addBreak} disabled={!newBreak.name} className="w-full p-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex justify-center"><Plus size={20} /></button></div></div>{data.breaks.length > 0 && (<div className="max-h-40 overflow-y-auto space-y-1 pt-2 pr-1 custom-scrollbar">{data.breaks.map(item => (<div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-orange-100 text-xs shadow-sm"><div className="flex gap-2"><span className="font-semibold text-orange-900">{item.name}</span><span className="text-gray-400">|</span><span className="text-gray-700 font-medium">{item.day}</span><span className="text-gray-500">{item.start}-{item.end}</span></div><button onClick={() => removeBreak(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>))}</div>)}</div>
      {/* 3. ÖZEL DERSLER */}
      <div className="p-5 bg-teal-50 rounded-xl border border-teal-100 space-y-4"><div className="flex items-center gap-2 text-teal-800 font-medium"><BookOpen size={20} /><h3>Özel Dersler</h3></div><div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"><div className="sm:col-span-4"><label className="block text-xs font-medium text-gray-500 mb-1">Ders Adı</label><input type="text" placeholder="Örn: Matematik" value={newLesson.name} onChange={e => setNewLesson({...newLesson, name: e.target.value})} className="w-full p-2 rounded border border-teal-200 text-sm" /></div><div className="sm:col-span-3"><label className="block text-xs font-medium text-gray-500 mb-1">Gün</label><select value={newLesson.day} onChange={e => setNewLesson({...newLesson, day: e.target.value})} className="w-full p-2 rounded border border-teal-200 text-sm bg-white">{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Başla</label><input type="time" value={newLesson.start} onChange={e => setNewLesson({...newLesson, start: e.target.value})} className="w-full p-2 rounded border border-teal-200 text-sm" /></div><div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Bitir</label><input type="time" value={newLesson.end} onChange={e => setNewLesson({...newLesson, end: e.target.value})} className="w-full p-2 rounded border border-teal-200 text-sm" /></div><div className="sm:col-span-1"><button onClick={addLesson} disabled={!newLesson.name} className="w-full p-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 flex justify-center"><Plus size={20} /></button></div></div>{data.privateLessons.length > 0 && (<div className="space-y-2 pt-2">{data.privateLessons.map(item => (<div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-teal-100 text-sm shadow-sm"><div className="flex gap-3"><span className="font-semibold text-teal-900">{item.name}</span><span className="text-gray-500">|</span><span className="text-gray-700">{item.day}</span><span className="text-gray-500">{item.start} - {item.end}</span></div><button onClick={() => removeLesson(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div>))}</div>)}</div>
      {/* 4. SOSYAL & SPORTİF */}
      <div className="p-5 bg-pink-50 rounded-xl border border-pink-100 space-y-4"><div className="flex items-center gap-2 text-pink-800 font-medium"><Palette size={20} /><h3>Spor / Sanat / Aktivite</h3></div><div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"><div className="sm:col-span-4"><label className="block text-xs font-medium text-gray-500 mb-1">Aktivite</label><input type="text" placeholder="Örn: Basketbol, Piyano" value={newActivity.name} onChange={e => setNewActivity({...newActivity, name: e.target.value})} className="w-full p-2 rounded border border-pink-200 text-sm" /></div><div className="sm:col-span-3"><label className="block text-xs font-medium text-gray-500 mb-1">Gün</label><select value={newActivity.day} onChange={e => setNewActivity({...newActivity, day: e.target.value})} className="w-full p-2 rounded border border-pink-200 text-sm bg-white">{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Başla</label><input type="time" value={newActivity.start} onChange={e => setNewActivity({...newActivity, start: e.target.value})} className="w-full p-2 rounded border border-pink-200 text-sm" /></div><div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Bitir</label><input type="time" value={newActivity.end} onChange={e => setNewActivity({...newActivity, end: e.target.value})} className="w-full p-2 rounded border border-pink-200 text-sm" /></div><div className="sm:col-span-1"><button onClick={addActivity} disabled={!newActivity.name} className="w-full p-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:opacity-50 flex justify-center"><Plus size={20} /></button></div></div>{data.socialActivities.length > 0 && (<div className="space-y-2 pt-2">{data.socialActivities.map(item => (<div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-pink-100 text-sm shadow-sm"><div className="flex gap-3"><span className="font-semibold text-pink-900">{item.name}</span><span className="text-gray-500">|</span><span className="text-gray-700">{item.day}</span><span className="text-gray-500">{item.start} - {item.end}</span></div><button onClick={() => removeActivity(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div>))}</div>)}</div>
      <div className="pt-4 flex justify-between"><button onClick={onBack} className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">Geri</button><button onClick={onNext} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95">Sonraki: Çalışma Tarzı<ChevronRight size={20} /></button></div>
    </div>
  );
}

/* ============================================== */
/* ADIM 4: ÇALIŞMA TARZI                          */
/* ============================================== */
function Step4Style({
  data,
  update,
  onFinish,
  onBack
}: {
  data: PlannerData;
  update: (f: Partial<PlannerData>) => void;
  onFinish: () => void;
  onBack: () => void;
}) {

  const SUBJECTS = ['Türkçe', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'İngilizce', 'Din Kültürü'];
  const [customStudy, setCustomStudy] = useState('');
  const [customBreak, setCustomBreak] = useState('');

  useEffect(() => {
    const presets = ['30+10', '40+10', '50+15'];
    if (data.studyTempo && !presets.includes(data.studyTempo)) {
      const [s, b] = data.studyTempo.split('+');
      if (s && b) { setCustomStudy(s); setCustomBreak(b); }
    }
  }, [data.studyTempo]);

  const toggleSubject = (sub: string) => {
    const current = data.difficultSubjects;
    if (current.includes(sub)) { update({ difficultSubjects: current.filter(s => s !== sub) }); }
    else { update({ difficultSubjects: [...current, sub] }); }
  };

  const handleCustomTempoChange = (study: string, breakTime: string) => {
    setCustomStudy(study); setCustomBreak(breakTime);
    if (study && breakTime) { update({ studyTempo: `${study}+${breakTime}` }); }
  };

  const changeFreq = (sub: string, delta: number) => {
    const current = data.subjectFrequencies[sub] || 2;
    const newVal = Math.max(1, Math.min(7, current + delta));
    update({ subjectFrequencies: { ...data.subjectFrequencies, [sub]: newVal } });
  };

  const isCustomSelected = data.studyTempo === `${customStudy}+${customBreak}`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1"><h2 className="text-lg font-semibold text-gray-800">Çalışma Tarzın</h2><p className="text-sm text-gray-500">Son adım! Yapay zeka programını bu bilgilere göre optimize edecek.</p></div>
      {/* 1. ZORLANDIĞIN DERSLER */}
      <div className="space-y-3"><h3 className="text-sm font-medium text-gray-700 flex items-center gap-2"><Brain size={18} className="text-purple-600" />Hangi derslerde daha çok zorlanıyorsun?</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{SUBJECTS.map(sub => (<button key={sub} onClick={() => toggleSubject(sub)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${data.difficultSubjects.includes(sub) ? 'bg-purple-100 border-purple-500 text-purple-800 ring-1 ring-purple-500' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{sub}</button>))}</div><p className="text-xs text-gray-500">* Bu derslere programda daha fazla ağırlık vereceğiz.</p></div>
      {/* 2. DERS SIKLIKLARI */}
      <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={18} className="text-green-600" />Hangi dersi haftada kaç gün çalışmak istersin?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUBJECTS.map(sub => (
            <div key={sub} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">{sub}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => changeFreq(sub, -1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold">-</button>
                <span className="text-sm font-bold w-4 text-center">{data.subjectFrequencies[sub] || 2}</span>
                <button onClick={() => changeFreq(sub, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-bold">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 3. ÇALIŞMA TEMPOSU */}
      <div className="space-y-3"><h3 className="text-sm font-medium text-gray-700 flex items-center gap-2"><Clock size={18} className="text-blue-600" />Sana en uygun çalışma temposu hangisi?</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><button onClick={() => update({ studyTempo: '30+10' })} className={`p-4 rounded-xl border-2 text-left transition-all relative ${data.studyTempo === '30+10' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}><div className="flex justify-between items-start mb-2"><Zap size={24} className={data.studyTempo === '30+10' ? 'text-blue-600' : 'text-gray-400'} />{data.studyTempo === '30+10' && <CheckCircle2 size={20} className="text-blue-600" />}</div><div className="font-bold text-gray-800">30 dk Ders</div><div className="text-sm text-gray-600">+ 10 dk Mola</div></button><button onClick={() => update({ studyTempo: '40+10' })} className={`p-4 rounded-xl border-2 text-left transition-all relative ${data.studyTempo === '40+10' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}><div className="flex justify-between items-start mb-2"><Clock size={24} className={data.studyTempo === '40+10' ? 'text-blue-600' : 'text-gray-400'} />{data.studyTempo === '40+10' && <CheckCircle2 size={20} className="text-blue-600" />}</div><div className="font-bold text-gray-800">40 dk Ders</div><div className="text-sm text-gray-600">+ 10 dk Mola</div></button><button onClick={() => update({ studyTempo: '50+15' })} className={`p-4 rounded-xl border-2 text-left transition-all relative ${data.studyTempo === '50+15' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}><div className="flex justify-between items-start mb-2"><Brain size={24} className={data.studyTempo === '50+15' ? 'text-blue-600' : 'text-gray-400'} />{data.studyTempo === '50+15' && <CheckCircle2 size={20} className="text-blue-600" />}</div><div className="font-bold text-gray-800">50 dk Ders</div><div className="text-sm text-gray-600">+ 15 dk Mola</div></button><div className={`p-4 rounded-xl border-2 transition-all relative ${isCustomSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}><div className="flex justify-between items-start mb-2"><Settings size={24} className={isCustomSelected ? 'text-blue-600' : 'text-gray-400'} />{isCustomSelected && <CheckCircle2 size={20} className="text-blue-600" />}</div><div className="font-bold text-gray-800 mb-2">Kendi Düzenim</div><div className="flex gap-3"><div><label className="text-xs text-gray-500 block mb-1">Ders (dk)</label><input type="number" value={customStudy} onChange={(e) => handleCustomTempoChange(e.target.value, customBreak)} className="w-full p-2 rounded border border-gray-300 text-sm w-20" placeholder="45" /></div><div className="pt-6 text-gray-400">+</div><div><label className="text-xs text-gray-500 block mb-1">Mola (dk)</label><input type="number" value={customBreak} onChange={(e) => handleCustomTempoChange(customStudy, e.target.value)} className="w-full p-2 rounded border border-gray-300 text-sm w-20" placeholder="15" /></div></div></div></div></div>
      <div className="pt-6 flex justify-between border-t border-gray-100"><button onClick={onBack} className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">Geri</button><button onClick={onFinish} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"><Brain className="animate-pulse" size={20} />Yapay Zeka ile Oluştur</button></div>
    </div>
  );
}
