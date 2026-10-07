// usePhoneWidth - true on a phone-sized screen (480px wide or less). The player panel must not grow on a
// phone (Tom, 2026-10-07: "player panel has to fit on a phone, it can not be bigger"), so the extras that
// make it bigger on a PC or TV (large face, big money, big mentor, the full mat) switch to their compact
// forms here.
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 480px)';

export const isPhoneWidth = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

export function usePhoneWidth(): boolean {
  const [phone, setPhone] = useState(isPhoneWidth);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}
