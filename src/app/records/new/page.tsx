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

  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [note, setNote] = useState('');
  const [dateMode, setDateMode] = useState<'today' | 'specific' | 'off'>('today');
  const [specificDate, setSpecificDate] = useState(todayLocalISODate());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [msg, setMsg] = useState<string>();

  /* ========= Dersleri yükle ========= */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase.from('subjects').select('id,name').order('name');
      setSubjects((data ?? []) as Subject[]);
    })();
  }, [uid]);

  /* ========= Ders seçimine göre konular & kaynaklar ========= */
  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      setSources([]);
      setTopicId('');
      setSourceId('');
      return;
    }

    (async () => {
      const { data: t1 } = await supabase
        .from('topics')
        .select('id,name,subject_id')
        .eq('subject_id', subjectId)
        .order('name');
      setTopics((t1 ?? []) as Topic[]);

      const { data: s2 } = await supabase
        .from('sources')
        .select('id,name,subject_id,user_id')
        .eq('user_id', uid)
        .eq('subject_id', subjectId)
        .order('name');
      setSources((s2 ?? []) as Source[]);
    })();
  }, [uid, subjectId]);

  /* ========= Düzenleme modunda veriyi yükle ========= */
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

  /* ========= Yeni kaynak ekle ========= */
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

      setSources((prev) => [...prev, data as Source].sort((a, b) => a.name.localeCompare(b.name)));
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

    // --- YENİ EKLENEN KONTROL ---
    // Eğer soru sayısı girilmişse (q > 0) ve kaynak seçili değilse hata ver.
    if (q && q > 0 && !sourceId) {
      // Eğer input alanında bir metin varsa ama ekle butonuna basılmamışsa kullanıcıyı uyar.
      if (newSourceName.trim().length > 0) {
        return setMsg('Kaynak ismini yazdınız ama "Ekle" butonuna basmadınız. Lütfen önce kaynağı ekleyin.');
      }
      return setMsg('Soru sayısı girdiğinizde mutlaka bir Kaynak seçmelisiniz.');
    }
    // -----------------------------

    let activity_date: string | null = null;
    let off_calendar = false;
    if (dateMode === 'today') {
      activity_date = todayLocalISODate();
    } else if (dateMode === 'specific') {
      activity_date = specificDate || todayLocalISODate();
    } else {
      off_calendar = true;
    }

    setMsg(undefined);

    if (editId) {
      const { error } = await supabase
        .from('records')
        .update({
          subject_id: subjectId,
          topic_id: topicId || null,
          source_id: sourceId || null,
          question_count: q,
          duration_min: d,
          note: note.trim() || null,
          activity_date,
          off_calendar,
        })
        .eq('id', editId);

      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg('Kayıt güncellendi.');
      router.push('/records');
    } else {
      const { error } = await supabase.from('records').insert({
        user_id: uid,
        subject_id: subjectId,
        topic_id: topicId || null,
        source_id: sourceId || null,
        question_count: q,
        duration_min: d,
        note: note.trim() || null,
        activity_date,
        off_calendar,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setQuestionCount('');
      setDurationMin('');
      setNote('');
      // Kayıt başarılı olduğunda topic ve source'u sıfırlamak isteğe bağlıdır,
      // seri giriş için genelde tutmak iyidir ama sıfırlamak isterseniz:
      // setTopicId('');
      // setSourceId('');
      setMsg('Kayıt oluşturuldu.');
    }
  }

  const subjectName = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.name || '',
    [subjects, subjectId]
  );

  if (loading)
    return (
      <main className="px-2 py-5">
        <p className="text-sm text-gray-600">Yükleniyor…</p>
      </main>
    );

  if (!uid) return null;

  return (
    <main className="py-3 sm:py-5 space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editId ? 'Kaydı Düzenle' : 'Çalışma Ekle'}</h1>
        <div className="flex gap-2">
          <Link href="/records" className="rounded-lg bg-purple-600 text-white px-3 py-1 text-sm hover:bg-purple-700">
            Kayıt listesi
          </Link>
          <Link href="/kaynaklarim" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
            Kaynaklarım
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
        {/* Ders */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Ders</label>
          <select className="rounded-lg border p-1" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">Ders Seçiniz…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Konu */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Konu</label>
          <select className="rounded-lg border p-1" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Konu Seçiniz...</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Kaynak */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Kaynak</label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <select className="rounded-lg border p-1" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Kaynak Seçiniz…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
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

        {/* Soru Sayısı */}
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
              <span>Takvim dışı (Belirsiz Tarih)</span>
            </label>
          </div>

          {dateMode === 'specific' && (
            <input className="mt-2 w-52 rounded-lg border p-1" type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} />
          )}
        </div>

        {msg && <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded">{msg}</p>}

        <div className="pt-1 flex justify-end">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            {editId ? 'Kaydı Güncelle' : 'Kaydı Kaydet'}
          </button>
        </div>
      </form>
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
