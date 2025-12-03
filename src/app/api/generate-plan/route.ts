import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

/* --- YARDIMCI FONKSİYONLAR (MATEMATİK MOTORU) --- */

// "14:30" -> 870 (dakika) çevirici
function timeToMin(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 870 -> "14:30" çevirici
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

type Block = {
  start: string;
  end: string;
  activity: string;
  type: string;
  startMin: number;
  endMin: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData } = body;

    // 1. GÜVENLİK: Token Kontrolü
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Oturum anahtarı (Token) eksik.' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth Hatası:", authError);
      return NextResponse.json({ error: 'Oturum açılmamış veya süresi dolmuş.' }, { status: 401 });
    }

    // --- ADIM 1: ALGORİTMİK İSKELET OLUŞTURMA ---
    // (Yapay zeka yerine Matematiği kullanıyoruz)

    const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const scheduleSkeleton: { day: string; blocks: Block[] }[] = [];

    // Tempo Ayrıştırma (40+10 -> 40, 10)
    let studyDur = 40;
    let breakDur = 10;
    if (formData.studyTempo && formData.studyTempo.includes('+')) {
      const p = formData.studyTempo.split('+');
      studyDur = parseInt(p[0]);
      breakDur = parseInt(p[1]);
    }

    // Gece Bitiş (Dakika cinsinden)
    const dayEndMin = timeToMin(formData.workEndTime);

    // Kullanıcı Tanımlı Blokları (Dolu Zamanlar) Hazırla
    const userBlocks = [
        ...(formData.privateLessons || []),
        ...(formData.socialActivities || []),
        ...(formData.breaks || [])
    ].map((b: any) => ({ ...b, startMin: timeToMin(b.start), endMin: timeToMin(b.end) }));

    let totalLessonSlots = 0;

    // Her gün için döngü
    for (const day of DAYS) {
      const dailyBlocks: Block[] = [];
      const isWeekend = day === 'Cumartesi' || day === 'Pazar';
      const isSaturday = day === 'Cumartesi';
      const isSunday = day === 'Pazar';

      // 1. SABİT BLOKLARI EKLE (Okul, Kurs, Bilsem, Kullanıcı Aktiviteleri)

      // A. Okul (Hafta İçi)
      if (!isWeekend) {
        const s = timeToMin(formData.schoolStartTime);
        const e = timeToMin(formData.schoolEndTime);
        dailyBlocks.push({ start: formData.schoolStartTime, end: formData.schoolEndTime, activity: 'Okul', type: 'school', startMin: s, endMin: e });
      }

      // B. Kurslar
      if (!isWeekend && formData.hasWeekdayCourse) {
         dailyBlocks.push({ start: formData.weekdayCourseStart, end: formData.weekdayCourseEnd, activity: 'Dershane/Etüt', type: 'course', startMin: timeToMin(formData.weekdayCourseStart), endMin: timeToMin(formData.weekdayCourseEnd) });
      }
      if (isSaturday && formData.hasSaturdayCourse) {
         dailyBlocks.push({ start: formData.saturdayCourseStart, end: formData.saturdayCourseEnd, activity: 'Kurs', type: 'course', startMin: timeToMin(formData.saturdayCourseStart), endMin: timeToMin(formData.saturdayCourseEnd) });
      }
      if (isSunday && formData.hasSundayCourse) {
         dailyBlocks.push({ start: formData.sundayCourseStart, end: formData.sundayCourseEnd, activity: 'Kurs', type: 'course', startMin: timeToMin(formData.sundayCourseStart), endMin: timeToMin(formData.sundayCourseEnd) });
      }

      // C. BİLSEM
      if (formData.goesToBilsem && formData.bilsemDays && formData.bilsemDays.includes(day)) {
          dailyBlocks.push({ start: formData.bilsemStart, end: formData.bilsemEnd, activity: 'BİLSEM', type: 'bilsem', startMin: timeToMin(formData.bilsemStart), endMin: timeToMin(formData.bilsemEnd) });
      }

      // D. Kullanıcı Aktiviteleri/Molaları
      const todaysUserBlocks = userBlocks.filter((b: any) => b.day === day || b.day === 'Her Gün' || (b.day === 'Hafta İçi' && !isWeekend) || (b.day === 'Hafta Sonu' && isWeekend));
      todaysUserBlocks.forEach((b: any) => {
          dailyBlocks.push({ start: b.start, end: b.end, activity: b.name, type: b.type || 'activity', startMin: b.startMin, endMin: b.endMin });
      });

      // E. Kitap Okuma (Gece Bitişten Önceki 30dk)
      if (formData.readBookBeforeSleep) {
          const bookStart = dayEndMin - 30;
          dailyBlocks.push({ start: minToTime(bookStart), end: minToTime(dayEndMin), activity: 'Kitap Okuma', type: 'activity', startMin: bookStart, endMin: dayEndMin });
      }

      // Blokları saate göre sırala
      dailyBlocks.sort((a, b) => a.startMin - b.startMin);

      // 2. BOŞLUKLARI BUL VE DOLDUR
      const finalBlocks: Block[] = [];

      // Başlangıç Saati Belirleme
      let currentTime = 6 * 60; // Varsayılan 06:00
      if (formData.wantsMorningStudy && formData.morningDays && formData.morningDays.includes(day)) {
          currentTime = timeToMin(formData.morningStart);
      } else {
          // Sabah çalışması yoksa, hafta içi okuldan sonra başla, hafta sonu 09:00
          if (!isWeekend) currentTime = timeToMin(formData.schoolEndTime);
          else currentTime = 9 * 60;
      }

      // Mevcut dolu blokların aralarını doldur
      for (const block of dailyBlocks) {
        // Eğer şimdiki zaman ile bir sonraki dolu blok arasında boşluk varsa
        if (currentTime < block.startMin) {
            let gap = block.startMin - currentTime;

            // Bu boşluğa kaç ders sığar?
            while (gap >= studyDur) {
                // DERS EKLE
                finalBlocks.push({
                    start: minToTime(currentTime),
                    end: minToTime(currentTime + studyDur),
                    activity: 'AI_FILL_ME', // <-- Yapay Zeka burayı dolduracak
                    type: 'lesson',
                    startMin: currentTime,
                    endMin: currentTime + studyDur
                });
                totalLessonSlots++;
                currentTime += studyDur;
                gap -= studyDur;

                // MOLA EKLE
                if (gap >= breakDur) {
                    finalBlocks.push({
                        start: minToTime(currentTime),
                        end: minToTime(currentTime + breakDur),
                        activity: `${breakDur} dk Mola`,
                        type: 'break',
                        startMin: currentTime,
                        endMin: currentTime + breakDur
                    });
                    currentTime += breakDur;
                    gap -= breakDur;
                }
            }
        }

        // Dolu bloğu listeye ekle ve zamanı güncelle
        finalBlocks.push(block);
        currentTime = Math.max(currentTime, block.endMin);
      }

      // Gün sonu boşluğunu doldur
      if (currentTime < dayEndMin) {
          let gap = dayEndMin - currentTime;
           while (gap >= studyDur) {
                finalBlocks.push({
                    start: minToTime(currentTime),
                    end: minToTime(currentTime + studyDur),
                    activity: 'AI_FILL_ME',
                    type: 'lesson',
                    startMin: currentTime,
                    endMin: currentTime + studyDur
                });
                totalLessonSlots++;
                currentTime += studyDur;
                gap -= studyDur;

                if (gap >= breakDur) {
                    finalBlocks.push({
                        start: minToTime(currentTime),
                        end: minToTime(currentTime + breakDur),
                        activity: `${breakDur} dk Mola`,
                        type: 'break',
                        startMin: currentTime,
                        endMin: currentTime + breakDur
                    });
                    currentTime += breakDur;
                    gap -= breakDur;
                }
            }
      }

      finalBlocks.sort((a, b) => a.startMin - b.startMin);
      scheduleSkeleton.push({ day, blocks: finalBlocks });
    }

    // --- ADIM 2: YAPAY ZEKADAN DERSLERİ İSTEME ---

    // 'gemini-pro' kullanıyoruz (en kararlı)
    const model = genAI.getGenerativeModel({
        model: 'gemini-pro',
        generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
        }
    });

    const prompt = `
      Sen bir LGS Koçusun. Aşağıda bir öğrencinin haftalık programının İSKELETİ var.
      Bazı kutular "AI_FILL_ME" olarak işaretli. Senin görevin SADECE bu kutulara ders isimlerini yerleştirmek.

      ÖĞRENCİ PROFİLİ:
      - Hedef: ${formData.targetType === 'school' ? formData.targetSchoolName : formData.targetScore}
      - Zayıf Dersler: ${formData.difficultSubjects?.join(', ')}
      - Ders Sıklıkları: ${Object.entries(formData.subjectFrequencies || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}

      KURALLAR:
      1. Her günün İLK "AI_FILL_ME" kutusuna MUTLAKA "Paragraf" yaz.
      2. Zayıf derslere öncelik ver.
      3. Sayısal ve Sözel dersleri ardışık bloklarda değiştir (Mat -> Türkçe -> Fen gibi) ki zihin yorulmasın.
      4. Sadece ders adını yaz (Örn: "Matematik", "Fen Bilimleri").
      5. "AI_FILL_ME" olmayan kutulara (Okul, Yemek, Mola vb.) DOKUNMA, aynen bırak.
      6. Haftanın son çalışma bloğuna "Haftalık Tekrar" yaz.

      AYRICA:
      - "target_analysis": Hedef okulu analiz et.
      - "expert_advice": Öğrenciye samimi, babacan ve profesyonel bir dille (3 paragraf) tavsiyeler ver.

      PROGRAM İSKELETİ (JSON):
      ${JSON.stringify(scheduleSkeleton)}

      ÇIKTI FORMATI (Sadece JSON):
      {
         "target_analysis": { ... },
         "expert_advice": "...",
         "schedule": [ ... (iskeletin aynısı, sadece AI_FILL_ME'ler değişmiş hali) ]
      }
    `;

    console.log("AI İsteği gönderiliyor...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // JSON Temizlik
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    const generatedData = JSON.parse(text);

    // --- ADIM 3: KAYDETME ---
    console.log("Veritabanına kaydediliyor...");

    await supabase.from('study_plans').update({ is_active: false }).eq('user_id', user.id);

    const { data: insertData, error: insertError } = await supabase
      .from('study_plans')
      .insert({
        user_id: user.id,
        is_active: true,
        target_details: { ...generatedData.target_analysis, user_input: formData.targetSchoolName || formData.targetScore },
        student_profile: formData,
        weekly_schedule: generatedData
      })
      .select().single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, planId: insertData.id });

  } catch (error: any) {
    console.error('GENEL API HATASI:', error);
    return NextResponse.json({ error: 'Sunucu hatası.', details: error.message }, { status: 500 });
  }
}
