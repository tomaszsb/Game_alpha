// src/services/SpeechService.ts
// Web Speech API wrapper for character voice narration.
// Standalone module — no game state deps, not part of ServiceProvider.

import { CHARACTER_MAP, extractPrefix, PM_VOICED_SPACES } from '../constants/characters';

export interface VoiceProfile {
  pitch: number;    // 0–2, default 1
  rate: number;     // 0.1–10, default 1
  volume: number;   // 0–1, default 1
  name: string;     // character display name
}

/** Voice profiles keyed by space prefix (pitch/rate/volume are voice-specific, name from CHARACTER_MAP) */
export const CHARACTER_PROFILES: Record<string, VoiceProfile> = {
  OWNER:     { pitch: 0.9,  rate: 0.95, volume: 1,   name: CHARACTER_MAP['OWNER'].name },
  ARCH:      { pitch: 1.1,  rate: 1.0,  volume: 0.9, name: CHARACTER_MAP['ARCH'].name },
  ENG:       { pitch: 0.85, rate: 1.05, volume: 0.9, name: CHARACTER_MAP['ENG'].name },
  'REG-DOB': { pitch: 1.0,  rate: 0.9,  volume: 1,   name: CHARACTER_MAP['REG-DOB'].name },
  'REG-FDNY':{ pitch: 0.95, rate: 0.85, volume: 1,   name: CHARACTER_MAP['REG-FDNY'].name },
  CON:       { pitch: 0.8,  rate: 1.1,  volume: 1,   name: CHARACTER_MAP['CON'].name },
  NARRATOR:  { pitch: 1.0,  rate: 1.0,  volume: 0.9, name: 'Narrator' },
};

const MUTE_KEY = 'speech-muted';

let muted = typeof localStorage !== 'undefined'
  ? localStorage.getItem(MUTE_KEY) === 'true'
  : false;

let lastText = '';
let lastProfile: VoiceProfile | null = null;
let selectedVoice: SpeechSynthesisVoice | null = null;

/** Pick the best English voice available */
function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  // Prefer Google US English or any en- voice
  selectedVoice =
    voices.find(v => v.name.includes('Google US English')) ||
    voices.find(v => v.lang.startsWith('en') && v.localService) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0] || null;
}

// Listen for voices to load (async on many browsers)
if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

export function getProfileForSpace(spaceName: string): VoiceProfile {
  // PM-voiced spaces (fb:7065e8df) fall back to the neutral narrator voice —
  // the text is the PM's own first-person thought, not an NPC's, so reading
  // it in (say) the Architect's pitch/rate would be the audio version of the
  // same "which character is this?" confusion the visual badge fix addresses.
  if (PM_VOICED_SPACES.has(spaceName)) return CHARACTER_PROFILES.NARRATOR;
  const prefix = extractPrefix(spaceName);
  return CHARACTER_PROFILES[prefix] || CHARACTER_PROFILES.NARRATOR;
}

export function speak(text: string, profile: VoiceProfile, onEnd?: () => void): void {
  if (typeof speechSynthesis === 'undefined') return;
  if (muted) {
    onEnd?.();
    return;
  }

  stop();

  lastText = text;
  lastProfile = profile;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = profile.volume;
  if (selectedVoice) utterance.voice = selectedVoice;

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  speechSynthesis.speak(utterance);
}

export function stop(): void {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

export function replay(onEnd?: () => void): void {
  if (lastText && lastProfile) {
    speak(lastText, lastProfile, onEnd);
  }
}

export function isSpeaking(): boolean {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
}

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, String(value)); } catch { /* noop */ }
  if (value) stop();
}

export function isMuted(): boolean {
  return muted;
}
