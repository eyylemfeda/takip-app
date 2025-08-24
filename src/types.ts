// src/types.ts
export type SubjectRef = { name: string } | null;

export type Rec = {
  id: string;
  created_at: string;
  subjects: SubjectRef;
  question_count: number | null;
  duration_min: number | null;
  note: string | null;
};

export type Read = {
  id: string;
  created_at: string;
  title: string;
  pages: number | null;
};

export type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};
