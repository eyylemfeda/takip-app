'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SignupParams({ onFound }: { onFound: (code: string | null) => void }) {
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    onFound(code);
  }, [params, onFound]);

  return null;
}
