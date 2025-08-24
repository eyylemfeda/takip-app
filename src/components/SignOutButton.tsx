'use client';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();
  const handleClick = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <button
      onClick={handleClick}
      className="text-sm rounded-lg border px-3 py-1 hover:bg-gray-50"
    >
      Çıkış
    </button>
  );
}
