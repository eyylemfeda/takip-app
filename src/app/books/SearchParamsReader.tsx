'use client';

import { useSearchParams } from 'next/navigation';

export default function SearchParamsReader() {
  const params = useSearchParams();
  const selected = params.get('selected');

  if (!selected) return null;

  return <p>Seçilen kitap ID: {selected}</p>;
}
