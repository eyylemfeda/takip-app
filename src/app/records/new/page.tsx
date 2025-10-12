'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

// YYYY-MM-DD (yerel saat) döndürür
function todayLocalISODate(): string {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60_000);
  return local.toISOString().slice(0, 10);
}


interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  subject_id: string;
}

interface Source {
  id: string;
  name: string;
  subject_id: string;
  user_id: string;
}

export default function NewRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [uid, setUid] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | undefined>();
  const [dateMode, setDateMode] = useState<'today' | 'specific' | 'off'>('today');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [addingSource, setAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');

  // ========= Oturum UID'sini al =========
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/signin');
        return;
      }
      setUid(session.user.id);
    });
  }, [router]);

  // ========= Dersleri yükle =========
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: s1 } = await supabase
        .from('subjects')
        .select('id,name')
        .order('name');
      setSubjects((s1 ?? []) as Subject[]);
    })();
  }, [uid]);

  // ========= Ders seçimine göre konular & kaynaklar =========
  useEffect(() => {
    (async () => {
      if (!uid || !subjectId) {
        setTopics([]);
        setSources([]);
        setTopicId('');
        setSourceId('');
        return;
      }

      // Konular
      const { data: t1 } = await supabase
        .from('topics')
        .select('id,name,subject_id')
        .eq('subject_id', subjectId)
        .order('name');
      setTopics((t1 ?? []) as Topic[]);

      // Kaynaklar
      const { data: s2 } = await supabase
        .from('sources')
        .select('id,name,subject_id,user_id')
        .eq('user_id', uid)
        .eq('subject_id', subjectId)
        .order('name');
      setSources((s2 ?? []) as Source[]);
    })();
  }, [uid, subjectId]);

  // ========= Düzenleme modunda veriyi yükle =========
  useEffect(() => {
    if (!uid || !editId) return;

    (async () => {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('id', editId)
        .maybeSingle();

      if (error || !data) return;

      setSubjectId(data.subject_id || '');
      setTopicId(data.topic_id || '');
      setSourceId(data.source_id || '');
      setQuestionCount(data.question_count?.toString() || '');
      setDurationMin(data.duration_min?.toString() || '');
      setNote(data.note || '');

      if (data.off_calendar) {
        setDateMode('off');
      } else if (data.activity_date) {
        setDateMode('specific');
        setSpecificDate(data.activity_date);
      }
    })();
  }, [uid, editId]);

  // ========= Yeni kaynak ekle =========
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

  // ========= Kayıt oluştur =========
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
    }

    const payload = {
      user_id: uid,
      subject_id: subjectId,
      topic_id: topicId || null,
      source_id: sourceId || null,
      question_count: q,
      duration_min: d,
      note,
      activity_date,
      off_calendar,
    };

    const { error } = editId
      ? await supabase.from('records').update(payload).eq('id', editId)
      : await supabase.from('records').insert(payload);

    if (error) return setMsg(error.message);
    router.push('/records');
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-4">{editId ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ders seçimi */}
        <div>
          <label className="block font-medium mb-1">Ders</label>
          <select
            className="rounded-lg border p-1"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}   /* ✅ düzeltme yapıldı */
            required
          >
            <option value="">Ders seçiniz</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Konu seçimi */}
        <div>
          <label className="block font-medium mb-1">Konu</label>
          <select
            className="rounded-lg border p-1"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            <option value="">Konu seçiniz</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Kaynak seçimi */}
        <div>
          <label className="block font-medium mb-1">Kaynak</label>
          <select
            className="rounded-lg border p-1"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">Kaynak seçiniz</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Soru sayısı ve süre */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Soru Sayısı</label>
            <input
              type="number"
              className="w-full border rounded-lg p-1"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Süre (dakika)</label>
            <input
              type="number"
              className="w-full border rounded-lg p-1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
        </div>

        {/* Not */}
        <div>
          <label className="block font-medium mb-1">Not</label>
          <textarea
            className="w-full border rounded-lg p-1"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Tarih seçimi */}
        <div>
          <label className="block font-medium mb-1">Tarih</label>
          <div className="flex items-center gap-2">
            <label>
              <input
                type="radio"
                name="dateMode"
                value="today"
                checked={dateMode === 'today'}
                onChange={() => setDateMode('today')}
              />{' '}
              Bugün
            </label>
            <label>
              <input
                type="radio"
                name="dateMode"
                value="specific"
                checked={dateMode === 'specific'}
                onChange={() => setDateMode('specific')}
              />{' '}
              Belirli gün
            </label>
            <label>
              <input
                type="radio"
                name="dateMode"
                value="off"
                checked={dateMode === 'off'}
                onChange={() => setDateMode('off')}
              />{' '}
              Takvime ekleme
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

        {msg && <p className="text-red-600">{msg}</p>}

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {editId ? 'Kaydı Güncelle' : 'Kaydı Kaydet'}
        </button>
      </form>
    </div>
  );
}
