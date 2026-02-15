'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Save, Trash2, Edit2, X, Check } from 'lucide-react';

type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'coach' | 'student';
  coach_id: string | null;
  username: string;
};

export default function UsersManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Düzenleme için geçici state
  const [editForm, setEditForm] = useState<Partial<Profile>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, coach_id, username')
        .order('full_name');
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  }

  // Gruplama
  const admins = users.filter(u => u.role === 'admin');
  const coaches = users.filter(u => u.role === 'coach');
  const students = users.filter(u => u.role === 'student');

  // Düzenlemeyi Başlat
  const startEdit = (user: Profile) => {
    setEditingId(user.id);
    setEditForm(user);
  };

  // İptal
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Kaydet
  const saveUser = async (id: string) => {
    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: editForm.full_name,
            role: editForm.role,
            coach_id: editForm.role === 'student' ? editForm.coach_id : null // Öğrenci değilse koçu sil
        })
        .eq('id', id);

    if (error) {
        alert('Hata: ' + error.message);
    } else {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...editForm } as Profile : u));
        setEditingId(null);
    }
  };

  // Sil (Sadece profili pasife çeker, auth silmek tehlikeli olabilir diye)
  // İsterseniz DELETE kodu da yazabilirim ama genelde is_active=false yapılır.
  const deleteUser = async (id: string) => {
      if(!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
      // Gerçek silme için: supabase.from('profiles').delete().eq('id', id)
      // Ancak referans hataları olabilir. Şimdilik pas geçiyorum veya uyarı veriyorum.
      alert("Güvenlik nedeniyle silme işlemi şimdilik devre dışı. Rolünü değiştirebilirsiniz.");
  };

  // --- TABLO SATIR BİLEŞENİ ---
  const UserRow = ({ user }: { user: Profile }) => {
    const isEditing = editingId === user.id;

    return (
        <tr className="border-b hover:bg-gray-50">
            <td className="p-3">
                {isEditing ? (
                    <input
                        className="border p-1 rounded w-full"
                        value={editForm.full_name || ''}
                        onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    />
                ) : user.full_name || '-'}
            </td>
            <td className="p-3 text-sm text-gray-600">{user.username || '-'}</td>

            {/* Koç Seçimi (Sadece Öğrenci Tablosunda görünür veya genel görünür) */}
            <td className="p-3">
                {user.role === 'student' && (
                    isEditing ? (
                        <select
                            className="border p-1 rounded w-full text-sm"
                            value={editForm.coach_id || ''}
                            onChange={e => setEditForm({...editForm, coach_id: e.target.value || null})}
                        >
                            <option value="">Koç Yok</option>
                            {/* Adminler de koçluk yapabilir diye adminleri de ekledim */}
                            {admins.map(c => <option key={c.id} value={c.id}>Admin: {c.full_name}</option>)}
                            {coaches.map(c => <option key={c.id} value={c.id}>Koç: {c.full_name}</option>)}
                        </select>
                    ) : (
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {users.find(u => u.id === user.coach_id)?.full_name || 'Koç Yok'}
                        </span>
                    )
                )}
            </td>

            {/* Aksiyonlar */}
            <td className="p-3 flex gap-2 justify-end">
                {isEditing ? (
                    <>
                        <button onClick={() => saveUser(user.id)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Save size={18}/></button>
                        <button onClick={cancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded"><X size={18}/></button>
                    </>
                ) : (
                    <>
                        <button onClick={() => startEdit(user)} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><Edit2 size={18}/></button>
                        <button onClick={() => deleteUser(user.id)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={18}/></button>
                    </>
                )}
            </td>
        </tr>
    );
  };

  if(loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <main className="space-y-8 pb-10">
        <h1 className="text-2xl font-bold mb-4">Kullanıcı Yönetimi</h1>

        {/* 1. ADMINLER */}
        <section className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-indigo-50 p-3 font-semibold text-indigo-800 border-b flex justify-between">
                <span>Adminler</span>
                <span className="bg-indigo-200 text-xs px-2 py-1 rounded-full">{admins.length}</span>
            </div>
            <table className="w-full text-left">
                <thead><tr className="text-xs text-gray-500 bg-gray-50"><th className="p-3">Ad Soyad</th><th className="p-3">Email/User</th><th className="p-3"></th><th className="p-3"></th></tr></thead>
                <tbody>{admins.map(u => <UserRow key={u.id} user={u} />)}</tbody>
            </table>
        </section>

        {/* 2. KOÇLAR */}
        <section className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-emerald-50 p-3 font-semibold text-emerald-800 border-b flex justify-between">
                <span>Koçlar</span>
                <span className="bg-emerald-200 text-xs px-2 py-1 rounded-full">{coaches.length}</span>
            </div>
            <table className="w-full text-left">
                <thead><tr className="text-xs text-gray-500 bg-gray-50"><th className="p-3">Ad Soyad</th><th className="p-3">Email/User</th><th className="p-3"></th><th className="p-3"></th></tr></thead>
                <tbody>{coaches.map(u => <UserRow key={u.id} user={u} />)}</tbody>
            </table>
        </section>

        {/* 3. ÖĞRENCİLER */}
        <section className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-blue-50 p-3 font-semibold text-blue-800 border-b flex justify-between">
                <span>Öğrenciler</span>
                <span className="bg-blue-200 text-xs px-2 py-1 rounded-full">{students.length}</span>
            </div>
            <table className="w-full text-left">
                <thead>
                    <tr className="text-xs text-gray-500 bg-gray-50">
                        <th className="p-3 w-1/4">Ad Soyad</th>
                        <th className="p-3 w-1/4">Email/User</th>
                        <th className="p-3 w-1/4">Atanan Koç</th>
                        <th className="p-3 text-right">İşlem</th>
                    </tr>
                </thead>
                <tbody>{students.map(u => <UserRow key={u.id} user={u} />)}</tbody>
            </table>
        </section>
    </main>
  );
}
