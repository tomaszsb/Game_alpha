// src/hooks/useModalQueue.ts
//
// Queue for a single shared modal instance (fb:ac29b623).
//
// The shared DiceResultModal was toggled synchronously: clicking "Continue"
// starts the ~0.2s AnimatePresence exit animation, and if the player clicks
// the next action fast enough, the modal re-opens DURING that exit. Framer
// Motion then removes the re-entered child when the original exit completes,
// so the new modal flashes and vanishes — the player never reads the outcome.
//
// This hook is the same shape as the v3.0.9 life-event queue
// (`pendingLifeEvent` + flush-on-close in GameLayout): payloads are queued,
// and the modal only (re)opens once the previous instance has FULLY animated
// out. "Fully" means AnimatePresence's onExitComplete fired — not just
// isOpen flipping false — with a timeout fallback so a missed callback can
// never soft-lock the queue.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ModalQueue<T> {
  /** Payload for the currently shown (or exiting) modal. Stays set during
   *  the exit animation so the closing modal keeps rendering its content. */
  current: T | null;
  isOpen: boolean;
  /** True between close() and the modal's exit animation finishing. */
  isExiting: boolean;
  /** Number of payloads waiting behind the current one. */
  pendingCount: number;
  /** Queue a payload; the flush effect opens it as soon as the modal is idle
   *  (immediately if nothing is open or exiting). */
  enqueue: (payload: T) => void;
  /** Close the open modal — starts the exit window. */
  close: () => void;
  /** Wire to the modal's AnimatePresence onExitComplete — ends the exit
   *  window precisely when the animation is done. */
  handleExitComplete: () => void;
}

// ModalBase's exit transition is 0.2s. If onExitComplete never fires
// (defensive — e.g. the modal tree unmounts mid-exit), this fallback
// unblocks the queue so result modals can't soft-lock.
export const EXIT_FALLBACK_MS = 600;

export function useModalQueue<T>(options?: { blocked?: boolean }): ModalQueue<T> {
  const blocked = options?.blocked ?? false;
  const [current, setCurrent] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [queue, setQueue] = useState<T[]>([]);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimer.current !== null) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const enqueue = useCallback((payload: T) => {
    setQueue(prev => [...prev, payload]);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsExiting(true);
    clearFallback();
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      setIsExiting(false);
    }, EXIT_FALLBACK_MS);
  }, [clearFallback]);

  const handleExitComplete = useCallback(() => {
    clearFallback();
    setIsExiting(false);
  }, [clearFallback]);

  // Flush: open the next queued payload once the modal is fully idle.
  useEffect(() => {
    if (isOpen || isExiting || blocked || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue(prev => prev.slice(1));
    setIsOpen(true);
  }, [queue, isOpen, isExiting, blocked]);

  // Clear the fallback timer on unmount.
  useEffect(() => clearFallback, [clearFallback]);

  return { current, isOpen, isExiting, pendingCount: queue.length, enqueue, close, handleExitComplete };
}
