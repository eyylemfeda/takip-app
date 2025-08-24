'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Subject = { id: string; name: string };
type Topic   = { id: string; name: string; subject_id: string; created_at?: string };
type Source  = { id: string; name: string; subject_id: string; user_id: string };

export default function NewRecordPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);

  // temel listeler
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics]     = useState<Topic[]>([]);
  const [sources, setSources]   = useState<Source[]>([]);

  // form state
  const [subjectId, setSubjectId]         = useState<string>('');
  const [topicId, setTopicId]             = useState<string>(''); // seçilen id
  const [topicInput, setTopicInput]       = useState<string>(''); // görünen metin (datalist)
  const [sourceId, setSourceId]           = useState<string>('');
  const [questionCount, setQuestionCount] = useState<string>(''); // sayı
  const [durationMin, setDurationMin]     = useState<string>(''); // dk
  const [note, setNote]                   = useState<string>('');

  // yeni kaynak ekleme (inline)
  const [newSourceName, setNewSourceName] = useState<string>('');
  const [addingSource, setAddingSource]   = useState<boolean>(false);

  // tarih modu
  const [dateMode, setDateMode] = useState<'today' | 'pick' | 'off'>('today');
  const [activityDate, setActivityDate] = useState<string>(''); // YYYY-MM-DD

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // ilk yükleme: session + subjects
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      setUid(id);

      // Dersler
      const { data: s1 } = await supabase
        .from('subjects')
        .select('id,name')
        .order('name', { ascending: true });
      setSubjects((s1 ?? []) as Subject[]);
    })();
  }, []);

  // subject değişince: ilgili topics (eklenme sırasına göre) ve (kullanıcıya ait) sources getir
  useEffect(() => {
    if (!subjectId || !uid) {
      setTopics([]);
      setSources([]);
      setTopicId('');
      setTopicInput('');
      setSourceId('');
      return;
    }
    (async () => {
      // Konular — EKLENME SIRASI (created_at)
      const { data: t1 } = await supabase
        .from('topics')
        .select('id,name,subject_id,created_at')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true });
      setTopics((t1 ?? []) as Topic[]);
      setTopicId('');      // reset
      setTopicInput('');   // reset

      // Kaynaklar: bu kullanıcı + bu ders
      const { data: s2 } = await supabase
        .from('sources')
        .select('id,name,subject_id,user_id')
        .eq('user_id', uid)
        .eq('subject_id', subjectId)
        .order('name', { ascending: true });
      setSources((s2 ?? []) as Source[]);
      setSourceId(''); // reset
    })();
  }, [subjectId, uid]);

  // topicId elle değiştiğinde (option seçildiğinde) input metnini eşitle
  useEffect(() => {
    if (!topicId) return;
    const m = topics.find(t => t.id === topicId);
    if (m && m.name !== topicInput) setTopicInput(m.name);
  }, [topicId, topics]); // eslint-disable-line react-hooks/exhaustive-deps

  // yeni kaynak ekle (derse + kullanıcıya özel)
  async function handleAddSource() {
    if (!uid) return alert('Giriş gerekli.');
    if (!subjectId) return alert('Önce ders seçiniz.');
    const name = newSourceName.trim();
    if (!name) return;

    setAddingSource(true);
    try {
      const { data, error } = await supabase
        .from('sources')
        .insert({
          user_id: uid,
          subject_id: subjectId,
          name,
        })
        .select('id,name,subject_id,user_id')
        .single();

      if (error) throw error;

      // listeye ekle ve seçili yap
      setSources((prev) => {
        const arr = [...prev, data as Source].sort((a, b) => a.name.localeCompare(b.name));
        return arr;
      });
      setSourceId((data as any).id);
      setNewSourceName('');
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setAddingSource(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return alert('Giriş gerekli.');
    if (!subjectId) return alert('Ders seçiniz.');

    // Konu doğrulaması: id yoksa yazılan ada göre eşle
    let finalTopicId = topicId;
    if (!finalTopicId && topicInput.trim()) {
      const m = topics.find(
        (t) => t.name.toLowerCase() === topicInput.trim().toLowerCase()
      );
      if (m) finalTopicId = m.id;
    }
    if (!finalTopicId) return alert('Konu seçiniz (listeden seçin veya tam adını yazın).');

    if (!sourceId) return alert('Kaynak seçiniz.');

    // Soru sayısı veya süre: en az biri sayı olmalı (ya da ikisi de girilebilir)
    const q   = questionCount.trim() === '' ? null : Number(questionCount);
    const dur = durationMin.trim() === '' ? null : Number(durationMin);
    if ((q === null || isNaN(q)) && (dur === null || isNaN(dur))) {
      return alert('En az birini giriniz: Soru sayısı veya çalışma süresi.');
    }

    // tarih
    const payload: any = {
      user_id: uid,
      subject_id: subjectId,
      topic_id: finalTopicId,
      source_id: sourceId,
      question_count: q,
      duration_min: dur,
      note: note || null,
      off_calendar: dateMode === 'off',
    };

    if (dateMode === 'pick') {
      if (!activityDate) return alert('Tarih seçiniz.');
      payload.activity_date = activityDate; // YYYY-MM-DD
    } else if (dateMode === 'today') {
      payload.activity_date = todayStr;
      payload.off_calendar = false;
    } else {
      payload.activity_date = null;
    }

    const { error } = await supabase.from('records').insert(payload);
    if (error) {
      alert(error.message);
      return;
    }

    // temizle
    setQuestionCount('');
    setDurationMin('');
    setNote('');
    setTopicId('');
    setTopicInput('');
    setSourceId('');
    alert('Kayıt eklendi.');
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      {/* Başlık + sağda mor buton */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Çalışma Kaydı Ekle</h1>
        <Link
          href="/records"
          className="rounded-lg bg-purple-600 px-4 py-2 text-white text-sm font-medium hover:bg-purple-700"
        >
          Kayıt listesine git
        </Link>
      </div>

      {!uid ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p>Bu sayfa için giriş yapmalısınız.</p>
          <Link href="/login" className="text-indigo-600 hover:underline">Giriş</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          {/* Ders */}
          <div>
            <label className="mb-1 block text-sm font-medium">Ders</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded border p-2"
            >
              <option value="">Seçiniz…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Konu (datalist: yazdıkça filtrelenir, eklenme sırasına göre listelenir) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Konu</label>
            <input
              list="topicOptions"
              className="w-full rounded border p-2"
              placeholder={subjectId ? 'Konu seç / yaz…' : 'Önce ders seçiniz'}
              value={topicInput}
              onChange={(e) => {
                const v = e.target.value;
                setTopicInput(v);
                const m = topics.find(
                  (t) => t.name.toLowerCase() === v.trim().toLowerCase()
                );
                setTopicId(m ? m.id : '');
              }}
              disabled={!subjectId}
            />
            <datalist id="topicOptions">
              {topics.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              İpucu: Listeden seçebilir ya da “el…” yazarak hızlıca filtreleyebilirsiniz.
            </p>
          </div>

          {/* Kaynak (kullanıcı + derse özel) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Kaynak</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded border p-2"
                disabled={!subjectId}
              >
                <option value="">{subjectId ? 'Seçiniz…' : 'Önce ders seçiniz'}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* satır içi “yeni kaynak ekle” */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Yeni kaynak adı"
                  className="w-40 rounded border p-2 text-sm"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  disabled={!subjectId}
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={!subjectId || addingSource || !newSourceName.trim()}
                  className="rounded bg-emerald-600 px-3 py-2 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                  title="Bu derse özel yeni kaynak ekle"
                >
                  {addingSource ? 'Ekleniyor…' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>

          {/* Soru sayısı / Süre */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Soru Sayısı (opsiyonel)</label>
              <input
                type="number"
                min={0}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="w-full rounded border p-2"
                placeholder="örn. 35"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Çalışma Süresi (dk) (opsiyonel)</label>
              <input
                type="number"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full rounded border p-2"
                placeholder="örn. 40"
              />
            </div>
          </div>

          {/* Tarih seçimi */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Tarih</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="dateMode"
                  value="today"
                  checked={dateMode === 'today'}
                  onChange={() => setDateMode('today')}
                />
                <span>Bugün ({todayStr})</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="dateMode"
                  value="pick"
                  checked={dateMode === 'pick'}
                  onChange={() => setDateMode('pick')}
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
                <span>Takvim dışı (zamanı bilinmeyen)</span>
              </label>
            </div>

            {dateMode === 'pick' && (
              <div>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="rounded border p-2"
                  max={todayStr}
                />
              </div>
            )}
          </div>

          {/* Not */}
          <div>
            <label className="mb-1 block text-sm font-medium">Not (opsiyonel)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border p-2"
              rows={3}
              placeholder="Kısa not…"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Kaydı Oluştur
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
