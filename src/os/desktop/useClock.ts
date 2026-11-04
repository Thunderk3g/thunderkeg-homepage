'use client';

import { useEffect, useState } from 'react';

/** A Date that re-renders every `ms`, aligned to the next tick boundary. */
export function useClock(ms = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), ms);
    }, ms - (Date.now() % ms));
    return () => {
      clearTimeout(first);
      if (iv) clearInterval(iv);
    };
  }, [ms]);
  return now;
}
