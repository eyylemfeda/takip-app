'use client';

import { useSearchParams } from 'next/navigation';

export default function SearchParamsReader() {
  const searchParams = useSearchParams();
  const selected = searchParams.get('selected');

  if (!selected) return null;

  return <p className="text-sm text-blue-600">Seçilen kitap ID: {selected}</p>;
}
