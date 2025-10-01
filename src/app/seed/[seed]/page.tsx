'use client';

import { useEffect } from 'react';
import Page from '@/app/page';

export default function SeedPage({ params }: { params: { seed: string } }) {
  useEffect(() => {
    const s = Number(params.seed);
    if (!Number.isNaN(s)) {
      try { (window as any).__seed = s; } catch {}
    }
  }, [params.seed]);
  return <Page />;
}




