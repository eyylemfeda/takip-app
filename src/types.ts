// src/types.ts

export interface Subject {
  id: string;          // uuid
  name: string;
  is_active?: boolean | null;
  created_at?: string;
}

export interface Topic {
  id: string;          // uuid
  subject_id: string;  // uuid
  name: string;
  created_at?: string;
}

export interface Source {
  id: string;          // uuid
  user_id: string;     // uuid
  subject_id: string;  // uuid
  name: string;
  created_at?: string;
}

export interface Rec {
  id: string;
  user_id: string;
  created_at: string;
  question_count: number | null;
  duration_min: number | null;
  note: string | null;

  // ilişkiler:
  subjects?: { name: string } | null;
  topic_id?: string | null;
  source_id?: string | null;

  // opsiyonel alanlar:
  activity_date?: string | null;
  off_calendar?: boolean | null;
}

export interface Read {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  pages: number | null;
}

export interface Profile {
  id: string;     // uuid
  full_name?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean | null;
  email?: string | null;
}

export type BookStatus = 'active' | 'paused' | 'finished';

export interface Book {
  id: string;           // uuid
  user_id: string;      // uuid
  title: string;
  author?: string | null;
  total_pages?: number | null;
  cover_url?: string | null;
  status?: BookStatus | null;
  is_finished?: boolean | null;      // eski alanı da bırakıyoruz
  current_page?: number | null;      // kaldığım sayfa
  finished_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReadingLog {
  id: string;
  user_id: string;
  book_id?: string | null;
  pages?: number | null;
  page_number?: number | null; // yeni kolon
  created_at: string;
}

export type Id = string;
