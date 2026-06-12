// tests/hooks/useModalQueue.test.ts
//
// Regression tests for fb:ac29b623 — "result modal flash-closes on fast click".
// The shared DiceResultModal was a synchronous open/close toggle; reopening it
// during the previous instance's exit animation let the in-flight close swallow
// the new modal. useModalQueue holds the next result until the exit window is
// over (onExitComplete, with a timeout fallback).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalQueue, EXIT_FALLBACK_MS } from '../../src/hooks/useModalQueue';

describe('useModalQueue (fb:ac29b623)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens immediately when idle', () => {
    const { result } = renderHook(() => useModalQueue<string>());

    act(() => result.current.enqueue('result A'));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.current).toBe('result A');
    expect(result.current.pendingCount).toBe(0);
  });

  it('keeps the payload set during the exit window so the closing modal still renders content', () => {
    const { result } = renderHook(() => useModalQueue<string>());

    act(() => result.current.enqueue('result A'));
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isExiting).toBe(true);
    expect(result.current.current).toBe('result A');
  });

  it('does NOT reopen during the exit window — the fast-click flash scenario', () => {
    const { result } = renderHook(() => useModalQueue<string>());

    // Modal A open → player clicks Continue → exit animation starts.
    act(() => result.current.enqueue('result A'));
    act(() => result.current.close());

    // Player immediately clicks the next action; its result arrives mid-exit.
    act(() => result.current.enqueue('result B'));

    // Pre-fix behavior was isOpen=true here (reopen mid-exit → swallowed).
    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingCount).toBe(1);

    // Exit animation finishes → queued result opens.
    act(() => result.current.handleExitComplete());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.current).toBe('result B');
    expect(result.current.pendingCount).toBe(0);
  });

  it('falls back to a timeout if onExitComplete never fires (no soft-lock)', () => {
    const { result } = renderHook(() => useModalQueue<string>());

    act(() => result.current.enqueue('result A'));
    act(() => result.current.close());
    act(() => result.current.enqueue('result B'));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(EXIT_FALLBACK_MS);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.current).toBe('result B');
  });

  it('queues while the modal is open and flushes in FIFO order after each close', () => {
    const { result } = renderHook(() => useModalQueue<string>());

    act(() => result.current.enqueue('result A'));
    act(() => result.current.enqueue('result B'));
    act(() => result.current.enqueue('result C'));

    // A is showing; B and C wait — no in-place stomp of the open modal.
    expect(result.current.current).toBe('result A');
    expect(result.current.pendingCount).toBe(2);

    act(() => result.current.close());
    act(() => result.current.handleExitComplete());
    expect(result.current.current).toBe('result B');
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    act(() => result.current.handleExitComplete());
    expect(result.current.current).toBe('result C');
    expect(result.current.isOpen).toBe(true);
    expect(result.current.pendingCount).toBe(0);
  });

  it('holds the queue while blocked (e.g. LifeEventModal is up) and flushes on unblock', () => {
    const { result, rerender } = renderHook(
      ({ blocked }) => useModalQueue<string>({ blocked }),
      { initialProps: { blocked: true } }
    );

    act(() => result.current.enqueue('result A'));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.pendingCount).toBe(1);

    rerender({ blocked: false });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.current).toBe('result A');
  });
});
