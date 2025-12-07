import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* --- YARDIMCI FONKSİYONLAR --- */
function timeToMin(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

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

    // 1. API KEY KONTROLÜ
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'API Key bulunamadı! .env dosyanı kontrol et.' }, { status: 500 });
    }

    // 2. SUPABASE BAĞLANTISI
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Oturum anahtarı (Token) eksik.' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Oturum açılmamış.' }, { status: 401 });
    }

    // --- ADIM 1: İSKELET OLUŞTURMA ---
    const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const scheduleSkeleton: { day: string; blocks: Block[] }[] = [];
    let studyDur = 40;
    let breakDur = 10;
    if (formData.studyTempo && formData.studyTempo.includes('+')) {
      const p = formData.studyTempo.split('+');
      studyDur = parseInt(p[0]);
      breakDur = parseInt(p[1]);
    }
    const dayEndMin = timeToMin(formData.workEndTime);

    const userBlocks = [
        ...(formData.privateLessons || []),
        ...(formData.socialActivities || []),
        ...(formData.breaks || [])
    ].map((b: any) => ({ ...b, startMin: timeToMin(b.start), endMin: timeToMin(b.end) }));

    for (const day of DAYS) {
      const dailyBlocks: Block[] = [];
      const isWeekend = day === 'Cumartesi' || day === 'Pazar';

      // A. Okul
      if (!isWeekend) {
        dailyBlocks.push({ start: formData.schoolStartTime, end: formData.schoolEndTime, activity: 'Okul', type: 'school', startMin: timeToMin(formData.schoolStartTime), endMin: timeToMin(formData.schoolEndTime) });
      }

      // B. Kurslar ve Aktiviteler
      if (!isWeekend && formData.hasWeekdayCourse) {
         dailyBlocks.push({ start: formData.weekdayCourseStart, end: formData.weekdayCourseEnd, activity: 'Dershane/Etüt', type: 'course', startMin: timeToMin(formData.weekdayCourseStart), endMin: timeToMin(formData.weekdayCourseEnd) });
      }
      if (day === 'Cumartesi' && formData.hasSaturdayCourse) {
         dailyBlocks.push({ start: formData.saturdayCourseStart, end: formData.saturdayCourseEnd, activity: 'Kurs', type: 'course', startMin: timeToMin(formData.saturdayCourseStart), endMin: timeToMin(formData.saturdayCourseEnd) });
      }
      if (day === 'Pazar' && formData.hasSundayCourse) {
         dailyBlocks.push({ start: formData.sundayCourseStart, end: formData.sundayCourseEnd, activity: 'Kurs', type: 'course', startMin: timeToMin(formData.sundayCourseStart), endMin: timeToMin(formData.sundayCourseEnd) });
      }
      if (formData.goesToBilsem && formData.bilsemDays && formData.bilsemDays.includes(day)) {
          dailyBlocks.push({ start: formData.bilsemStart, end: formData.bilsemEnd, activity: 'BİLSEM', type: 'bilsem', startMin: timeToMin(formData.bilsemStart), endMin: timeToMin(formData.bilsemEnd) });
      }

      const todaysUserBlocks = userBlocks.filter((b: any) => b.day === day || b.day === 'Her Gün' || (b.day === 'Hafta İçi' && !isWeekend) || (b.day === 'Hafta Sonu' && isWeekend));
      todaysUserBlocks.forEach((b: any) => {
          dailyBlocks.push({ start: b.start, end: b.end, activity: b.name, type: b.type || 'activity', startMin: b.startMin, endMin: b.endMin });
      });

       // Kitap Okuma (Gece)
       if (formData.readBookBeforeSleep) {
        const bookStart = dayEndMin - 30;
        dailyBlocks.push({ start: minToTime(bookStart), end: minToTime(dayEndMin), activity: 'Kitap Okuma', type: 'activity', startMin: bookStart, endMin: dayEndMin });
       }

      // Boşlukları Doldur
      dailyBlocks.sort((a, b) => a.startMin - b.startMin);
      const finalBlocks: Block[] = [];
      let currentTime = (!isWeekend) ? timeToMin(formData.schoolEndTime) : 9 * 60;
      if (formData.wantsMorningStudy && formData.morningDays?.includes(day)) currentTime = timeToMin(formData.morningStart);

      for (const block of dailyBlocks) {
        if (currentTime < block.startMin) {
            let gap = block.startMin - currentTime;
            while (gap >= studyDur) {
                finalBlocks.push({ start: minToTime(currentTime), end: minToTime(currentTime + studyDur), activity: 'AI_FILL_ME', type: 'lesson', startMin: currentTime, endMin: currentTime + studyDur });
                currentTime += studyDur; gap -= studyDur;
                if (gap >= breakDur) { finalBlocks.push({ start: minToTime(currentTime), end: minToTime(currentTime + breakDur), activity: `${breakDur} dk Mola`, type: 'break', startMin: currentTime, endMin: currentTime + breakDur }); currentTime += breakDur; gap -= breakDur; }
            }
        }
        finalBlocks.push(block);
        currentTime = Math.max(currentTime, block.endMin);
      }
      // Gün sonuna kadar doldur
      if (currentTime < dayEndMin) {
          let gap = dayEndMin - currentTime;
          while (gap >= studyDur) {
                finalBlocks.push({ start: minToTime(currentTime), end: minToTime(currentTime + studyDur), activity: 'AI_FILL_ME', type: 'lesson', startMin: currentTime, endMin: currentTime + studyDur });
                currentTime += studyDur; gap -= studyDur;
                if (gap >= breakDur) { finalBlocks.push({ start: minToTime(currentTime), end: minToTime(currentTime + breakDur), activity: `${breakDur} dk Mola`, type: 'break', startMin: currentTime, endMin: currentTime + breakDur }); currentTime += breakDur; gap -= breakDur; }
            }
      }
      finalBlocks.sort((a, b) => a.startMin - b.startMin);
      scheduleSkeleton.push({ day, blocks: finalBlocks });
    }

    // --- ADIM 2: MODELİ OTOMATİK BUL VE İSTEK AT ---
    console.log("1. Uygun modeller aranıyor...");

    // Önce hangi modellerin açık olduğunu soruyoruz
    const listModelsReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listModelsData = await listModelsReq.json();

    let selectedModel = "models/gemini-1.5-flash";

    if (listModelsData.models) {
        const validModel = listModelsData.models.find((m: any) =>
            m.name.includes('gemini') &&
            m.supportedGenerationMethods?.includes('generateContent')
        );
        if (validModel) selectedModel = validModel.name;
    }

    // --- GÜNCELLENMİŞ PROMPT: HAZIR VERİLERİ KULLAN ---
    const prompt = `
      Sen profesyonel bir LGS Koçusun.
      GÖREV: Programdaki "AI_FILL_ME" kutularını doldur ve hedef okulu analiz et.

      ÖĞRENCİ VERİLERİ (KESİN BİLGİLER):
      - Hedef Okul: "${formData.targetSchoolName || ''}"
      - Hedef Puan: "${formData.targetScore || ''}"
      - Hedef Yüzdelik: "${formData.targetPercentile || ''}"
      - Zayıf Dersler: ${formData.difficultSubjects?.join(', ')}
      - Sıklıklar: ${Object.entries(formData.subjectFrequencies || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}

      HEDEF OKUL ANALİZİ:
      1. Okul Adı: Verilen okul adını kullan.
      2. Puan & Yüzdelik: Yukarıdaki verileri aynen kullan. Eğer boşsalar mantıklı bir tahmin yap ama boş bırakma.

      HİTAP KURALLARI (ÇOK ÖNEMLİ):
      1. **YASAK:** Öğrenciye ASLA okul adıyla (Örn: "Merhaba Sırrı", "Naber Kabataş") hitap etme!
      2. **DOĞRUSU:** "Merhaba Sevgili Öğrenci" diye başla.

      PROGRAM KURALLARI:
      1. İlk kutu her gün "Paragraf Soru Çözümü".
      2. Dersler: Matematik, Fen Bilimleri, T.C. İnkılap, İngilizce, Din Kültürü, Türkçe.
      3. Blok ders yap (Mat, Mat). Hafta sonu esnek ol.

      ÇIKTI (JSON):
      {
         "target_analysis": {
            "school_name": "Tam Okul Adı",
            "min_score": 484.55,
            "percentile": "0.92",
            "motivation": "Motive edici kısa bir cümle."
         },
         "expert_advice": "Samimi koç tavsiyesi. Mutlaka 'Merhaba Sevgili Öğrenci' diye başla.",
         "schedule": [ ... ]
      }

      PROGRAM İSKELETİ:
      ${JSON.stringify(scheduleSkeleton)}
    `;
    console.log(`2. AI İsteği gönderiliyor (${selectedModel})...`);

    const modelNameClean = selectedModel.replace('models/', '');

    const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelNameClean}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
    );

    if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI Hatası: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Yapay zeka boş cevap döndü.");

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    let generatedData;
    try {
        generatedData = JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Hatası:", text);
        throw new Error("Yapay zeka formatı bozdu.");
    }

    // --- EMNİYET SİBOBU (FALLBACK) ---
    // AI veriyi boş gönderirse biz dolduruyoruz.
    const analysis = generatedData.target_analysis || {};

    // 1. Okul Adı Yoksa Düzelt
    if (!analysis.school_name || analysis.school_name.length < 3) {
        analysis.school_name = formData.targetSchoolName || "Hedef Lise";
    }

    // 2. Puan Yoksa Düzelt (480-495 arası rastgele ata eğer hedef okulsa)
    if (!analysis.min_score || analysis.min_score === 0) {
        // Eğer kullanıcı puan girdiyse onu kullan, yoksa yüksek bir hedef ata
        const userScore = parseFloat(formData.targetScore);
        if (userScore > 0) {
            analysis.min_score = userScore;
        } else {
             // Fen veya Anadolu lisesi gibi düşünerek yüksek puan atıyoruz
            analysis.min_score = 480 + Math.floor(Math.random() * 10);
        }
    }

    // 3. Yüzdelik Yoksa Düzelt
    if (!analysis.percentile || analysis.percentile === "" || analysis.percentile === "0") {
        if (analysis.min_score > 480) analysis.percentile = "0.85";
        else if (analysis.min_score > 460) analysis.percentile = "2.1";
        else analysis.percentile = "5.0";
    }

    // Veriyi güncelle
    generatedData.target_analysis = analysis;

    // --- ADIM 3: KAYDETME ---
    console.log("3. Veritabanına kaydediliyor...");
    await supabase.from('study_plans').update({ is_active: false }).eq('user_id', user.id);

    const targetDetailsToSave = {
        ...generatedData.target_analysis,
        user_input: formData.targetSchoolName || formData.targetScore
    };

    const { data: insertData, error: insertError } = await supabase
      .from('study_plans')
      .insert({
        user_id: user.id,
        is_active: true,
        target_details: targetDetailsToSave,
        student_profile: formData,
        weekly_schedule: generatedData
      })
      .select().single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, planId: insertData.id });

  } catch (error: any) {
    console.error('GENEL API HATASI:', error);
    return NextResponse.json({ error: error.message || 'Sunucu hatası.' }, { status: 500 });
  }
}
