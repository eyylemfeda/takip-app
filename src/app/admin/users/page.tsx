'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {
  Users, Search, Edit2, Trash2, X, Save,
  CheckCircle, Shield, User as UserIcon, Loader2
} from 'lucide-react';

// --- TİPLER ---
type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  // created_at alanını kaldırdık, çünkü tabloda olmayabilir
};

// ==========================================
// 1. DÜZENLEME PENCERESİ (MODAL) - BAĞIMSIZ BİLEŞEN
// ==========================================
function EditUserModal({
  user,
  onClose,
  onSave
}: {
  user: Profile;
  onClose: () => void;
  onSave: (id: string, newName: string, newRole: string) => Promise<void>;
}) {
  const [name, setName] = useState(user.full_name || '');
  const [role, setRole] = useState(user.role || 'student');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(user.id, name, role);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Kullanıcı Düzenle</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ad Soyad Giriniz"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Rolü</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="student">Öğrenci</option>
              <option value="coach">Koç / Eğitmen</option>
              <option value="admin">Yönetici (Admin)</option>
            </select>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. ANA SAYFA BİLEŞENİ
// ==========================================
export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // Kullanıcıları Çek
  async function fetchUsers() {
    setLoading(true);

    // DÜZELTME BURADA YAPILDI:
    // .order('created_at') yerine .order('full_name') kullanıldı.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true }); // İsim sırasına göre getir (En güvenlisi)

    if (error) {
      console.error('Kullanıcılar çekilemedi:', error.message);
      // Hata olsa bile boş array set edelim ki uygulama çökmesin
      setUsers([]);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Kaydetme İşlemi
  async function handleUpdateUser(id: string, newName: string, newRole: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: newName,
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('Güncelleme başarısız: ' + error.message);
    } else {
      setUsers(prev => prev.map(u =>
        u.id === id ? { ...u, full_name: newName, role: newRole } : u
      ));
    }
  }

  // Silme İşlemi
  async function handleDeleteUser(id: string) {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;

    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (error) {
      alert('Silinemedi: ' + error.message);
    } else {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  }

  // Arama Filtresi
  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">

      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Users className="text-indigo-600" size={32} />
            Kullanıcı Yönetimi
          </h1>
          <p className="text-gray-500 mt-1">Sistemdeki tüm kullanıcıları görüntüleyin ve düzenleyin.</p>
        </div>

        {/* Arama */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="İsim veya rol ara..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TABLO */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Kullanıcı</th>
                <th className="p-4 font-semibold">Rol</th>
                <th className="p-4 font-semibold">Durum</th>
                <th className="p-4 font-semibold text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Yükleniyor...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                     {/* Eğer hata varsa konsola baktıracak bir ipucu */}
                     Kullanıcı bulunamadı. (Veritabanı bağlantısını kontrol edin)
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                          {user.full_name ? user.full_name[0].toUpperCase() : '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.full_name || <span className="text-gray-400 italic">İsimsiz Kullanıcı</span>}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">ID: {user.id.slice(0,8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                        ${user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                          user.role === 'coach' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'}
                      `}>
                        {user.role === 'admin' && <Shield size={12}/>}
                        {user.role === 'coach' && <CheckCircle size={12}/>}
                        {user.role === 'student' && <UserIcon size={12}/>}
                        {user.role === 'admin' ? 'Yönetici' : user.role === 'coach' ? 'Eğitmen' : 'Öğrenci'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">Aktif</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

    </div>
  );
}
