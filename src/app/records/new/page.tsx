'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useRequireActiveUser } from '@/lib/hooks/useRequireActiveUser';

export const dynamic = 'force-dynamic';

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subject_id: string };
type Source = { id: string; name: string; subject_id: string; user_id: string };

// LGS Ders Şablonu (Görseldeki isimlerle birebir aynı olmalı)
const LGS_TEMPLATE = [
  { name: 'Türkçe', total: 20 },
  { name: 'Matematik', total: 20 },
  { name: 'Fen Bilimleri', total: 20 },
  { name: 'T.C. İnkılap Tarihi', total: 10 },
  { name: 'Din Kültürü ve Ahlak Bilgisi', total: 10 },
  { name: 'İngilizce', total: 10 },
];

function todayLocalISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDMYFromISO(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function NewRecordInner() {
  const { uid, loading } = useRequireActiveUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');

  // --- MOD SEÇİMİ ---
  const [mode, setMode] = useState<'single' | 'lgs'>('single');

  // --- TEKLİ GİRİŞ STATE'LERİ ---
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [note, setNote] = useState('');

  // --- TARİH ---
  const [dateMode, setDateMode] = useState<'today' | 'specific' | 'off'>('today');
  const [specificDate, setSpecificDate] = useState(todayLocalISODate());

  // --- LGS MODU STATE'LERİ ---
  const [denemeAdi, setDenemeAdi] = useState('');
  const [lgsScores, setLgsScores] = useState<{ [key: string]: { dogru: number; yanlis: number } }>({});

  // --- LISTELER ---
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [msg, setMsg] = useState<string>();

  /* ========= Dersleri Yükle ========= */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase.from('subjects').select('id,name').order('name');
      setSubjects((data ?? []) as Subject[]);
    })();
  }, [uid]);

  /* ========= Konu/Kaynak Yükle (Sadece Tekli Mod) ========= */
  useEffect(() => {
    if (!subjectId || mode === 'lgs') {
      setTopics([]);
      setSources([]);
      if (mode === 'single') {
          setTopicId('');
          setSourceId('');
      }
      return;
    }
    (async () => {
      const { data: t1 } = await supabase.from('topics').select('id,name,subject_id').eq('subject_id', subjectId).order('name');
      setTopics((t1 ?? []) as Topic[]);
      const { data: s2 } = await supabase.from('sources').select('id,name,subject_id,user_id').eq('user_id', uid).eq('subject_id', subjectId).order('name');
      setSources((s2 ?? []) as Source[]);
    })();
  }, [uid, subjectId, mode]);

  /* ========= Edit Modu ========= */
  useEffect(() => {
    if (!uid || !editId) return;
    (async () => {
      const { data, error } = await supabase.from('records').select('*').eq('id', editId).maybeSingle();
      if (error || !data) return;

      setSubjectId(data.subject_id || '');
      setTopicId(data.topic_id || '');
      setSourceId(data.source_id || '');
      setQuestionCount(data.question_count?.toString() || '');
      setDurationMin(data.duration_min?.toString() || '');
      setNote(data.note || '');
      if (data.off_calendar) setDateMode('off');
      else if (data.activity_date) {
        setDateMode('specific');
        setSpecificDate(data.activity_date);
      }
    })();
  }, [uid, editId]);

  /* ========= LGS Skor Değişimi ========= */
  const handleLgsScoreChange = (lessonName: string, type: 'dogru' | 'yanlis', val: string, max: number) => {
    const num = parseInt(val) || 0;
    setLgsScores(prev => {
        const current = prev[lessonName] || { dogru: max, yanlis: 0 };
        let newValues = { ...current };

        if (type === 'dogru') {
            if (num > max) newValues.dogru = max;
            else if (num + current.yanlis > max) newValues.dogru = max - current.yanlis;
            else newValues.dogru = num;
        } else {
            if (num > max) newValues.yanlis = max;
            else if (num + current.dogru > max) newValues.yanlis = max - current.dogru;
            else newValues.yanlis = num;
        }
        return { ...prev, [lessonName]: newValues };
    });
  };

  /* ========= Tekli Mod: Kaynak Ekle ========= */
  async function handleAddSource() {
    if (!uid) return alert('Giriş gerekli.');
    if (!subjectId) return alert('Önce ders seçiniz.');
    const name = newSourceName.replace(/\s+/g, ' ').trim();
    if (!name) return;

    setAddingSource(true);
    setMsg(undefined);
    try {
      const { data, error } = await supabase.from('sources').insert({ user_id: uid, subject_id: subjectId, name }).select().single();
      if (error) throw error;
      setSources((prev) => [...prev, data as Source].sort((a, b) => a.name.localeCompare(b.name)));
      setSourceId((data as Source).id);
      setNewSourceName('');
    } catch (e: any) {
      if (e?.code === '23505') setMsg('Bu derste aynı isimde bir kaynak zaten var.');
      else setMsg(e?.message || String(e));
    } finally {
      setAddingSource(false);
    }
  }

  /* ========= Tekli Mod: Kaydet ========= */
  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return setMsg('Giriş gerekli.');
    if (!subjectId) return setMsg('Ders seçiniz.');

    const q = questionCount ? Number(questionCount) : null;
    const d = durationMin ? Number(durationMin) : null;

    if (q === null && d === null) return setMsg('Soru sayısı veya süre giriniz.');
    if (q && q > 0 && !sourceId) {
        if (newSourceName.trim().length > 0) return setMsg('Kaynak ismini yazdınız ama "Ekle" butonuna basmadınız.');
        return setMsg('Soru sayısı girdiğinizde mutlaka bir Kaynak seçmelisiniz.');
    }

    let activity_date: string | null = null;
    let off_calendar = false;
    if (dateMode === 'today') activity_date = todayLocalISODate();
    else if (dateMode === 'specific') activity_date = specificDate || todayLocalISODate();
    else off_calendar = true;

    setMsg(undefined);

    const payload = {
        user_id: uid,
        subject_id: subjectId,
        topic_id: topicId || null,
        source_id: sourceId || null,
        question_count: q,
        duration_min: d,
        note: note.trim() || null,
        activity_date,
        off_calendar,
    };

    if (editId) {
        const { error } = await supabase.from('records').update(payload).eq('id', editId);
        if (error) return setMsg(error.message);
        setMsg('Kayıt güncellendi.');
        router.push('/records');
    } else {
        const { error } = await supabase.from('records').insert(payload);
        if (error) return setMsg(error.message);
        setQuestionCount('');
        setDurationMin('');
        setNote('');
        setMsg('Kayıt oluşturuldu.');
    }
  }

  /* ========= LGS DENEME KAYIT (STANDARDIZE EDİLMİŞ) ========= */
  async function handleLgsSubmit() {
    if (!uid) return setMsg('Giriş gerekli.');
    if (!denemeAdi.trim()) return setMsg('Lütfen Deneme Adını giriniz (Örn: Mozaik 1).');

    setMsg('Deneme kaydediliyor, lütfen bekleyiniz...');

    let activity_date: string | null = null;
    let off_calendar = false;
    if (dateMode === 'today') activity_date = todayLocalISODate();
    else if (dateMode === 'specific') activity_date = specificDate || todayLocalISODate();
    else off_calendar = true;

    try {
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalEmpty = 0;

        // 1. Önce 6 Ana Dersin Kaydını Hazırla
        const lessonPromises = LGS_TEMPLATE.map(async (lesson) => {
            // Ders ID'sini tam eşleşme ile bul
            const subject = subjects.find(s => s.name === lesson.name);

            if (!subject) {
                console.warn(`${lesson.name} için ders veritabanında bulunamadı!`);
                return null;
            }

            // A. KONU BUL/OLUŞTUR: "LGS Deneme" (Sabit Standart)
            let finalTopicId = null;
            const { data: existingTopics } = await supabase.from('topics')
                .select('id').eq('subject_id', subject.id).eq('name', 'LGS Deneme').maybeSingle();

            if (existingTopics) finalTopicId = existingTopics.id;
            else {
                const { data: newTopic } = await supabase.from('topics')
                    .insert({ subject_id: subject.id, name: 'LGS Deneme' }).select('id').single();
                if (newTopic) finalTopicId = newTopic.id;
            }

            // B. KAYNAK BUL/OLUŞTUR: "LGS Denemesi - Kurumsal Deneme" (Sabit Standart)
            let finalSourceId = null;
            const standardSourceName = 'LGS Denemesi - Kurumsal Deneme';

            const { data: existingSource } = await supabase.from('sources')
                .select('id').eq('user_id', uid).eq('subject_id', subject.id).eq('name', standardSourceName).maybeSingle();

            if (existingSource) finalSourceId = existingSource.id;
            else {
                const { data: newSource } = await supabase.from('sources')
                    .insert({ user_id: uid, subject_id: subject.id, name: standardSourceName }).select('id').single();
                if (newSource) finalSourceId = newSource.id;
            }

            // C. İstatistikler
            const scores = lgsScores[lesson.name] || { dogru: lesson.total, yanlis: 0 };
            const bos = lesson.total - scores.dogru - scores.yanlis;

            // Toplam hesaplama için topla
            totalCorrect += scores.dogru;
            totalWrong += scores.yanlis;
            totalEmpty += bos;

            return {
                user_id: uid,
                subject_id: subject.id,
                topic_id: finalTopicId,
                source_id: finalSourceId,
                question_count: lesson.total, // İstatistikler için soru sayısı girilir
                note: `[${denemeAdi}]`, // Deneme adı nota yazılır
                correct_count: scores.dogru,
                wrong_count: scores.yanlis,
                empty_count: bos,
                activity_date,
                off_calendar
            };
        });

        const lessonRecords = (await Promise.all(lessonPromises)).filter(r => r !== null);

        // 2. "LGS Denemeleri" Dersi İçin Özet Kayıt Hazırla
        // Bu kayıt soru sayısını 0 girer ki toplamı bozmasın, ama listede görünür.
        const summarySubject = subjects.find(s => s.name === 'LGS Denemeleri');

        if (summarySubject) {

            // Özet kayıt verisi
            const totalNet = totalCorrect - (totalWrong / 3);

            lessonRecords.push({
                user_id: uid,
                subject_id: summarySubject.id,
                topic_id: null,
                source_id: null,
                question_count: 0, // DİKKAT: Toplamı şişirmemesi için 0
                note: `${denemeAdi} - Toplam Net: ${totalNet.toFixed(2)}`,
                correct_count: totalCorrect,
                wrong_count: totalWrong,
                empty_count: totalEmpty,
                activity_date,
                off_calendar
            });
        }

        // 3. Hepsini Kaydet
        if (lessonRecords.length > 0) {
            const { error } = await supabase.from('records').insert(lessonRecords);
            if (error) throw error;

            setMsg(`Tebrikler! ${denemeAdi} başarıyla kaydedildi.`);
            setDenemeAdi('');
            setLgsScores({});
        }

    } catch (err: any) {
        console.error(err);
        setMsg(`Hata: ${err.message}`);
    }
  }

  const subjectName = useMemo(() => subjects.find((s) => s.id === subjectId)?.name || '', [subjects, subjectId]);

  if (loading) return <main className="px-2 py-5"><p className="text-sm text-gray-600">Yükleniyor…</p></main>;
  if (!uid) return null;

  return (
    <main className="py-3 sm:py-5 space-y-4">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{editId ? 'Kaydı Düzenle' : 'Çalışma Ekle'}</h1>

        {/* MOD DEĞİŞTİRİCİ BUTONLAR */}
        {!editId && (
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                    onClick={() => setMode('single')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'single' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Tek Ders
                </button>
                <button
                    onClick={() => setMode('lgs')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'lgs' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    🚀 LGS Deneme
                </button>
            </div>
        )}

        <div className="flex gap-2">
          <Link href="/records" className="rounded-lg bg-gray-600 text-white px-3 py-1 text-sm hover:bg-gray-700">Liste</Link>
          <Link href="/kaynaklarim" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">Kaynaklar</Link>
        </div>
      </div>

      <div className={`space-y-4 rounded-xl border bg-white p-4 shadow-sm ${mode === 'lgs' ? 'border-purple-200 bg-purple-50/30' : ''}`}>

        {/* ---------------- LGS DENEME MODU FORMU ---------------- */}
        {mode === 'lgs' && !editId ? (
            <div className="space-y-5">
                <div className="grid gap-1">
                    <label className="text-sm font-bold text-gray-800">Deneme Adı / Yayını</label>
                    <input
                        className="rounded-lg border p-2 w-full focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Örn: Mozaik Yayınları 3. Deneme"
                        value={denemeAdi}
                        onChange={(e) => setDenemeAdi(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                        Sorular otomatik olarak <b>LGS Deneme</b> konusuna ve <b>LGS Denemesi - Kurumsal Deneme</b> kaynağına eklenecektir.
                    </p>
                </div>

                <div className="grid gap-3">
                   <h3 className="font-semibold text-gray-700 border-b pb-1">Ders Sonuçları</h3>
                   {LGS_TEMPLATE.map((lesson) => {
                       const score = lgsScores[lesson.name] || { dogru: lesson.total, yanlis: 0 };
                       const bos = lesson.total - score.dogru - score.yanlis;
                       const net = score.dogru - (score.yanlis / 3);

                       return (
                           <div key={lesson.name} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-lg border gap-2">
                               <div className="font-medium text-gray-800 w-36 text-sm">{lesson.name}</div>

                               <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
                                   <div className="flex flex-col items-center">
                                       <label className="text-[10px] font-bold text-green-600 uppercase">Doğru</label>
                                       <input
                                         type="number" min="0" max={lesson.total}
                                         value={score.dogru}
                                         onChange={(e) => handleLgsScoreChange(lesson.name, 'dogru', e.target.value, lesson.total)}
                                         className="w-14 p-1 text-center border rounded font-bold text-green-700 focus:ring-green-500 focus:outline-none"
                                       />
                                   </div>
                                   <div className="flex flex-col items-center">
                                       <label className="text-[10px] font-bold text-red-600 uppercase">Yanlış</label>
                                       <input
                                         type="number" min="0" max={lesson.total}
                                         value={score.yanlis}
                                         onChange={(e) => handleLgsScoreChange(lesson.name, 'yanlis', e.target.value, lesson.total)}
                                         className="w-14 p-1 text-center border rounded font-bold text-red-700 focus:ring-red-500 focus:outline-none"
                                       />
                                   </div>
                                   <div className="flex flex-col items-center opacity-60">
                                       <label className="text-[10px] font-bold text-gray-600 uppercase">Boş</label>
                                       <div className="w-10 py-1 text-center font-medium bg-gray-100 rounded text-sm">{bos}</div>
                                   </div>
                                   <div className="flex flex-col items-center w-16 bg-purple-100 rounded px-1 py-0.5 ml-2">
                                       <span className="text-[10px] text-purple-600 font-bold">NET</span>
                                       <span className="font-bold text-purple-800 text-lg">{net.toFixed(2)}</span>
                                   </div>
                               </div>
                           </div>
                       )
                   })}
                </div>
            </div>
        ) : (
        /* ---------------- TEKLİ KAYIT FORMU ---------------- */
            <>
                <div className="grid gap-1">
                <label className="text-sm font-medium">Ders</label>
                <select className="rounded-lg border p-1" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                    <option value="">Ders Seçiniz…</option>
                    {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                </div>

                <div className="grid gap-1">
                <label className="text-sm font-medium">Konu</label>
                <select className="rounded-lg border p-1" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    <option value="">Konu Seçiniz...</option>
                    {topics.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                </div>

                <div className="grid gap-1">
                <label className="text-sm font-medium">Kaynak</label>
                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                    <select className="rounded-lg border p-1" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                    <option value="">Kaynak Seçiniz…</option>
                    {sources.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                        className="rounded-lg border px-2 py-1 text-sm"
                        placeholder={subjectId ? `${subjectName} için yeni kaynak…` : 'Önce Ders Seçiniz...'}
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        disabled={!uid || !subjectId}
                    />
                    <button
                        type="button"
                        onClick={handleAddSource}
                        disabled={!uid || !subjectId || !newSourceName.trim() || addingSource}
                        className="rounded-lg bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
                    >
                        {addingSource ? 'Ekleniyor…' : 'Ekle'}
                    </button>
                    </div>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                        <label className="text-sm font-medium">Soru Sayısı</label>
                        <input className="rounded-lg border p-1" type="number" placeholder="örn. 35" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} min={0} />
                    </div>
                    <div className="grid gap-1">
                        <label className="text-sm font-medium">Süre (Dk)</label>
                        <input className="rounded-lg border p-1" type="number" placeholder="örn. 40" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min={0} />
                    </div>
                </div>

                <div className="grid gap-1">
                    <label className="text-sm font-medium">Not (Opsiyonel)</label>
                    <textarea className="rounded-lg border p-1 text-sm" rows={2} placeholder="Notunuz..." value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
            </>
        )}

        {/* --- ORTAK TARİH ALANI --- */}
        <div className="grid gap-1 border-t pt-4 mt-2">
          <label className="text-sm font-medium">Tarih</label>
          <div className="flex flex-wrap items-center gap-x-3">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="dateMode" value="today" checked={dateMode === 'today'} onChange={() => setDateMode('today')} />
              <span>Bugün ({formatDMYFromISO(todayLocalISODate())})</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="dateMode" value="specific" checked={dateMode === 'specific'} onChange={() => setDateMode('specific')} />
              <span>Farklı tarih</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="dateMode" value="off" checked={dateMode === 'off'} onChange={() => setDateMode('off')} />
              <span>Takvim dışı</span>
            </label>
          </div>
          {dateMode === 'specific' && (
            <input className="mt-2 w-52 rounded-lg border p-1" type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} />
          )}
        </div>

        {msg && <p className={`text-sm font-medium p-2 rounded ${msg.includes('Tebrikler') ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

        <div className="pt-1 flex justify-end">
          {mode === 'lgs' && !editId ? (
              <button onClick={handleLgsSubmit} type="button" className="rounded bg-purple-600 px-6 py-2.5 font-bold text-white hover:bg-purple-700 shadow-md">
                  🚀 Tüm Denemeyi Kaydet
              </button>
          ) : (
              <button onClick={handleSingleSubmit} type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  {editId ? 'Kaydı Güncelle' : 'Kaydı Kaydet'}
              </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewRecordPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <NewRecordInner />
    </Suspense>
  );
}
