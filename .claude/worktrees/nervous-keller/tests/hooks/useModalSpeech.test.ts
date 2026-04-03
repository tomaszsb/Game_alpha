import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the SpeechService module
vi.mock('../../src/services/SpeechService', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
  replay: vi.fn(),
  isMuted: vi.fn().mockReturnValue(false),
  setMuted: vi.fn(),
  getProfileForSpace: vi.fn().mockReturnValue({
    pitch: 0.9, rate: 0.95, volume: 1, name: 'The Owner',
  }),
}));

import { useModalSpeech } from '../../src/hooks/useModalSpeech';
import * as SpeechService from '../../src/services/SpeechService';

describe('useModalSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SpeechService.isMuted as any).mockReturnValue(false);
  });

  it('should return speech controls', () => {
    const { result } = renderHook(() =>
      useModalSpeech('Hello', 'OWNER-SCOPE-INITIATION', false)
    );

    expect(result.current).toHaveProperty('isSpeaking');
    expect(result.current).toHaveProperty('stop');
    expect(result.current).toHaveProperty('replay');
    expect(result.current).toHaveProperty('muted');
    expect(result.current).toHaveProperty('toggleMute');
  });

  it('should speak when modal opens (isOpen transitions false→true)', () => {
    const { rerender } = renderHook(
      ({ text, space, isOpen }) => useModalSpeech(text, space, isOpen),
      { initialProps: { text: 'Hello owner', space: 'OWNER-SCOPE-INITIATION', isOpen: false } }
    );

    expect(SpeechService.speak).not.toHaveBeenCalled();

    // Transition to open
    rerender({ text: 'Hello owner', space: 'OWNER-SCOPE-INITIATION', isOpen: true });

    expect(SpeechService.getProfileForSpace).toHaveBeenCalledWith('OWNER-SCOPE-INITIATION');
    expect(SpeechService.speak).toHaveBeenCalledTimes(1);
    expect(SpeechService.speak).toHaveBeenCalledWith(
      'Hello owner',
      expect.objectContaining({ name: 'The Owner' }),
      expect.any(Function)
    );
  });

  it('should stop speech when modal closes', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', isOpen),
      { initialProps: { isOpen: false } }
    );

    // Open
    rerender({ isOpen: true });
    // Close
    rerender({ isOpen: false });

    expect(SpeechService.stop).toHaveBeenCalled();
  });

  it('should not speak when text is empty', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useModalSpeech('', 'OWNER-SCOPE-INITIATION', isOpen),
      { initialProps: { isOpen: false } }
    );

    rerender({ isOpen: true });
    expect(SpeechService.speak).not.toHaveBeenCalled();
  });

  it('should not speak when spaceName is undefined', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useModalSpeech('Hello', undefined, isOpen),
      { initialProps: { isOpen: false } }
    );

    rerender({ isOpen: true });
    expect(SpeechService.speak).not.toHaveBeenCalled();
  });

  it('should call stop on the service when stop is invoked', () => {
    const { result } = renderHook(() =>
      useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', true)
    );

    act(() => {
      result.current.stop();
    });

    expect(SpeechService.stop).toHaveBeenCalled();
  });

  it('should call replay on the service when replay is invoked', () => {
    const { result } = renderHook(() =>
      useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', true)
    );

    act(() => {
      result.current.replay();
    });

    expect(SpeechService.replay).toHaveBeenCalled();
  });

  it('should toggle mute state from unmuted to muted', () => {
    (SpeechService.isMuted as any).mockReturnValue(false);

    const { result } = renderHook(() =>
      useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', false)
    );

    expect(result.current.muted).toBe(false);

    // isMuted() returns false, so toggle computes !false = true → setMuted(true)
    act(() => {
      result.current.toggleMute();
    });

    expect(SpeechService.setMuted).toHaveBeenCalledWith(true);
    expect(result.current.muted).toBe(true);
  });

  it('should toggle mute state from muted to unmuted', () => {
    (SpeechService.isMuted as any).mockReturnValue(true);

    const { result } = renderHook(() =>
      useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', false)
    );

    expect(result.current.muted).toBe(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(SpeechService.setMuted).toHaveBeenCalledWith(false);
    expect(result.current.muted).toBe(false);
  });

  it('should not re-speak when modal stays open across rerenders', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useModalSpeech('Text', 'OWNER-SCOPE-INITIATION', isOpen),
      { initialProps: { isOpen: false } }
    );

    // Open
    rerender({ isOpen: true });
    expect(SpeechService.speak).toHaveBeenCalledTimes(1);

    // Rerender while still open
    rerender({ isOpen: true });
    expect(SpeechService.speak).toHaveBeenCalledTimes(1); // no additional call
  });
});
