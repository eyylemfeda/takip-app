'use client';
// Geçici uyumluluk: eski "@/lib/supabaseClient" importlarını çalıştırır
import { createClient } from './supabase/client';

export const supabase = createClient();
export default supabase;
