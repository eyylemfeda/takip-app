'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

/* ========= Tipler ========= */
type Subject = { id: string; name: string };
type Topic   = { id: string; name: string; subject_id: string };
type Source  = { id: string; name: string; subject_id: string; user_id: string };

/* ========= Yardımcılar ========= */
// Yerel gün için ISO "YYYY-MM-DD"
function todayLocalISODate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
// "YYYY-MM-DD" → "DD.MM.YYYY"
function formatDMYFromISO(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function NewRecordPage() {
  const [uid, setUid] = useState<string | null>(null);

  // form alanları
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [durationMin, setDurationMin] = useState(''); // gizli kullanıyorsan boş bırak
  const [note, setNote] = useState(''); // gizli kullanıyorsan boş bırak

  // tarih modu
  const [dateMode, setDateMode] = useState<'today' | 'specific' | 'off'>('today');
  const [specificDate, setSpecificDate] = useState(todayLocalISODate());

  // listeler
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  // yeni kaynak ekleme
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  const [msg, setMsg] = useState<string>();

  /* ========= Oturum & Dersler ========= */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUid(id);

      const { data: s1 } = await supabase
        .from('subjects')
        .select('id,name')
        .order('name');
      setSubjects((s1 ?? []) as Subject[]);
    })();
  }, []);

  /* ========= Ders seçimine göre konular & kaynaklar ========= */
  useEffect(() => {
    (async () => {
      if (!uid || !subjectId) {
        setTopics([]);
        setSources([]);
        setTopicId('');
        setSourceId('');
        return;
      }

      // Konular (ders bazlı)
      const { data: t1 } = await supabase
        .from('topics')
        .select('id,name,subject_id')
        .eq('subject_id', subjectId)
        .order('name');
      setTopics((t1 ?? []) as Topic[]);

      // Kaynaklar (kullanıcı + ders bazlı)
      const { data: s2 } = await supabase
        .from('sources')
        .select('id,name,subject_id,user_id')
        .eq('user_id', uid)
        .eq('subject_id', subjectId)
        .order('name');
      setSources((s2 ?? []) as Source[]);
    })();
  }, [uid, subjectId]);

  /* ========= Yeni kaynak ekle (kullanıcı + ders özel) ========= */
  async function handleAddSource() {
    if (!uid) return alert('Giriş gerekli.');
    if (!subjectId) return alert('Önce ders seçiniz.');
    const name = newSourceName.replace(/\s+/g, ' ').trim();
    if (!name) return;

    setAddingSource(true);
    setMsg(undefined);
    try {
      const { data, error } = await supabase
        .from('sources')
        .insert({ user_id: uid, subject_id: subjectId, name })
        .select('id,name,subject_id,user_id')
        .single();

      if (error) throw error;

      setSources(prev => [...prev, data as Source].sort((a, b) => a.name.localeCompare(b.name)));
      setSourceId((data as Source).id);
      setNewSourceName('');
    } catch (e: any) {
      if (e?.code === '23505') {
        setMsg('Bu derste aynı isimde bir kaynak zaten var.');
      } else {
        setMsg(e?.message || String(e));
      }
    } finally {
      setAddingSource(false);
    }
  }

  /* ========= Kayıt oluştur ========= */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return setMsg('Giriş gerekli.');
    if (!subjectId) return setMsg('Ders seçiniz.');

    const q = questionCount ? Number(questionCount) : null;
    const d = durationMin ? Number(durationMin) : null;
    if (q === null && d === null) {
      return setMsg('En az birini doldurun: Soru sayısı veya Çalışma süresi.');
    }

    let activity_date: string | null = null;
    let off_calendar = false;
    if (dateMode === 'today') {
      activity_date = todayLocalISODate();
    } else if (dateMode === 'specific') {
      activity_date = specificDate || todayLocalISODate();
    } else {
      off_calendar = true;
      activity_date = null;
    }

    setMsg(undefined);
    const { error } = await supabase.from('records').insert({
      user_id: uid,
      subject_id: subjectId,
      topic_id: topicId || null,
      source_id: sourceId || null,
      question_count: q,
      duration_min: d,
      note: note?.trim() || null,
      activity_date,
      off_calendar,
    });

    if (error) {
      setMsg(error.message);
      return;
    }
    // Temizlik
    setQuestionCount('');
    setDurationMin('');
    setNote('');
    setTopicId('');
    setSourceId('');
    setMsg('Kayıt oluşturuldu.');
  }

  const subjectName = useMemo(
    () => subjects.find(s => s.id === subjectId)?.name ?? '',
    [subjects, subjectId]
  );

  return (
    <main className="mx-auto max-w-none sm:max-w-3xl px-2 sm:px-4 md:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
      {/* Üst bar: başlık + sağda aksiyonlar */}
      <div className="mb-3 sm:mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Çalışma Ekle</h1>

        <div className="flex items-center gap-2">
          {/* Kayıt listesi */}
          <Link
            href="/records"
            className="inline-flex items-center justify-center
                       h-7 w-19
                       rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700
                       md:h-auto md:w-auto md:px-4 md:py-2 md:text-sm"
          >
            Kayıt listesi
          </Link>

          {/* Kaynaklarım */}
          <Link
            href="/kaynaklarim"
            className="inline-flex items-center justify-center
                       h-7 w-21
                       rounded-lg border text-sm font-medium hover:bg-gray-50
                       md:h-auto md:w-auto md:px-4 md:py-2 md:text-sm"
          >
            Kaynaklarım
          </Link>
        </div>
      </div>

      {/* Form kartı */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 sm:space-y-4 rounded-lg sm:rounded-xl border bg-white p-1 px-2 sm:p-4 md:p-6 shadow-sm"
      >
        {/* Ders */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Ders</label>
          <select
            className="rounded-lg border p-1"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
          >
            <option value="">Ders Seçiniz…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Konu */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Konu</label>
          <select
            className="rounded-lg border p-1"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            <option value="">Konu Seçiniz...</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Kaynak + hızlı ekle */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Kaynak</label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              className="rounded-lg border p-1"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Kaynak Seçiniz…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="h-9 md:h-10 rounded-lg border px-2 py-1 text-sm leading-tight appearance-none"
              placeholder={subjectId ? `${subjectName} için yeni kaynak…` : 'Önce Ders Seçiniz...'}
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              disabled={!uid || !subjectId}
            />
            <button
              type="button"
              onClick={handleAddSource}
              disabled={!uid || !subjectId || !newSourceName.trim() || addingSource}
              className="inline-flex h-9 md:h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-80"
            >
              {addingSource ? 'Ekleniyor…' : 'Ekle'}
            </button>
          </div>

          </div>
        </div>

        {/* Soru (Süre gizli ise yalnız bu kalsın) */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Soru Sayısı</label>
          <input
            className="rounded-lg border p-1"
            type="number"
            inputMode="numeric"
            placeholder="örn. 35"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            min={0}
          />
        </div>

        {/* Tarih */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Tarih</label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="dateMode"
                value="today"
                checked={dateMode === 'today'}
                onChange={() => setDateMode('today')}
              />
              <span>Bugün ({formatDMYFromISO(todayLocalISODate())})</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="dateMode"
                value="specific"
                checked={dateMode === 'specific'}
                onChange={() => setDateMode('specific')}
              />
              <span>Farklı tarih</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="dateMode"
                value="off"
                checked={dateMode === 'off'}
                onChange={() => setDateMode('off')}
              />
              <span>Takvim dışı (Belirsiz Tarih)</span>
            </label>
          </div>

          {dateMode === 'specific' && (
            <input
              className="mt-2 w-52 rounded-lg border p-1"
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>

        {/* Mesaj */}
        {msg && <p className="text-sm text-red-600">{msg}</p>}

        {/* Kaydı Oluştur — sağa dayalı */}
        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Kaydı Oluştur
          </button>
        </div>
      </form>
    </main>
  );
}
