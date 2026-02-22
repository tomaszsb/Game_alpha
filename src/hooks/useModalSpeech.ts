// src/hooks/useModalSpeech.ts
// Hook that manages speech lifecycle tied to modal open/close.

import { useState, useEffect, useRef, useCallback } from 'react';
import * as SpeechService from '../services/SpeechService';

export interface SpeechControls {
  isSpeaking: boolean;
  stop: () => void;
  replay: () => void;
  muted: boolean;
  toggleMute: () => void;
}

export function useModalSpeech(
  text: string | undefined,
  spaceName: string | undefined,
  isOpen: boolean
): SpeechControls {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(SpeechService.isMuted());
  const prevOpen = useRef(false);

  // Speak when modal opens (false→true transition)
  useEffect(() => {
    if (isOpen && !prevOpen.current && text && spaceName) {
      const profile = SpeechService.getProfileForSpace(spaceName);
      setIsSpeaking(true);
      SpeechService.speak(text, profile, () => setIsSpeaking(false));
    }
    // Stop when modal closes
    if (!isOpen && prevOpen.current) {
      SpeechService.stop();
      setIsSpeaking(false);
    }
    prevOpen.current = isOpen;
  }, [isOpen, text, spaceName]);

  const stop = useCallback(() => {
    SpeechService.stop();
    setIsSpeaking(false);
  }, []);

  const replay = useCallback(() => {
    setIsSpeaking(true);
    SpeechService.replay(() => setIsSpeaking(false));
  }, []);

  const toggleMute = useCallback(() => {
    const newVal = !SpeechService.isMuted();
    SpeechService.setMuted(newVal);
    setMuted(newVal);
    if (newVal) setIsSpeaking(false);
  }, []);

  return { isSpeaking, stop, replay, muted, toggleMute };
}
