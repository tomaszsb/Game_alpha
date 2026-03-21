# Speech System Plan — Character Voice Narration

## 1. SpeechService (`src/services/SpeechService.ts`)

Web Speech API (`window.speechSynthesis`) wrapper. No external dependencies.

### Audio Routing — Where the Voice Comes From

The game has two display modes:

- **TV mode** (`?mode=tv`): `TVDisplay.tsx` shows the board only — no modals, no interactivity. Players use their own phones. Since modals render on the player's device, `speechSynthesis` runs in that browser → **voice plays from the phone speaker**.
- **Desktop mode** (no TV): Player plays directly on their PC. Modals render on the PC → **voice plays from the PC speaker**.
- **Mixed**: Each player hears speech on whatever device they're using when it's their turn.

No special audio routing needed — Web Speech API naturally plays on the device where the modal opens, which is always the player's own device. The TV stays silent (no modals to trigger speech).

Stretch goal: optional "Player X's turn" announcement on TVDisplay for spectators.

### Voice Profiles

| Character | Space Prefix | Pitch | Rate | Volume | Persona |
|-----------|-------------|-------|------|--------|---------|
| Owner | OWNER | 0.9 | 0.95 | 1.0 | Authoritative, impatient businessman |
| Architect | ARCH | 1.1 | 0.85 | 0.9 | Thoughtful, measured professional |
| Engineer | ENG | 1.0 | 0.90 | 0.9 | Precise, technical, matter-of-fact |
| DOB Examiner | REG-DOB | 0.8 | 0.80 | 1.0 | Bored bureaucrat, monotone |
| FDNY Examiner | REG-FDNY | 0.85 | 0.90 | 1.0 | Gruff, no-nonsense fire marshal |
| Contractor | CON | 1.05 | 1.05 | 1.0 | Rough, fast-talking, street-smart |
| Narrator | (transitions) | 1.0 | 0.90 | 0.8 | Neutral storyteller voice |

Additional spaces (PM, LEND, BANK, INVESTOR, CHEAT, START, FINISH) use Narrator voice with minor tweaks.

### API Surface

```
SpeechService.speak(text, profile, onEnd?)
SpeechService.stop()
SpeechService.replay()
SpeechService.setMuted(boolean)
SpeechService.isMuted(): boolean
SpeechService.isSpeaking(): boolean
SpeechService.getProfileForSpace(spaceName): VoiceProfile
```

Mute preference persisted to `localStorage`.

### Browser Considerations
- Chrome requires a user gesture before first `speechSynthesis.speak()` — any click/tap suffices; modal open counts.
- Voice list loads async (`onvoiceschanged`). Pick best English voice at init, fall back to default.
- Mobile Safari: limited voice selection, may need `speak('')` warmup on first interaction.

---

## 2. Character Voice Modal Redesign

### Current Modal Flow (no speech)
1. Player lands on space → space effects applied
2. Modal opens showing story text + action description + dice/choice UI
3. Player interacts → modal closes → turn progresses

### Proposed Flow (with speech)
1. Player lands on space → space effects applied
2. Modal opens with **character identity badge** (name, role icon, phase color)
3. **Narrator intro** (1 sentence, ~3s): sets the scene
4. **Character speaks** (story text in first-person, ~5-10s)
5. Speech ends → **choices/dice activate** (greyed out until speech finishes, or skip button)
6. Player interacts → modal closes

### Identity Badge
Small header element inside ModalBase showing:
- Character name (e.g. "The Architect")
- Role subtitle (e.g. "Design Phase")
- Small avatar/icon per character (can be emoji initially)

### Controls (3 small icon buttons in modal header)
- **Stop** — cancels current speech
- **Replay** — replays from beginning
- **Mute** — toggle, persisted across sessions

---

## 3. Content Audit — Text Rewriting Scope

### Space Content (SPACE_CONTENT.csv)
- **54 rows** total (27 spaces x 2 visit types), minus 2 FINISH + 2 START = **50 rows needing first-person rewrites**
- Each row has **story** + **action_description** + **outcome_description** = up to 3 text fields per row
- Estimated **~130 individual text snippets** to rewrite

### Breakdown by Character

| Character | Spaces | Rows (First+Sub) | Text Snippets |
|-----------|--------|-------------------|---------------|
| Owner | OWNER-SCOPE-INITIATION, OWNER-FUND-INITIATION, OWNER-DECISION-REVIEW | 6 | ~15 |
| Architect | ARCH-INITIATION, ARCH-FEE-REVIEW, ARCH-SCOPE-CHECK | 6 | ~15 |
| Engineer | ENG-INITIATION, ENG-FEE-REVIEW, ENG-SCOPE-CHECK | 6 | ~15 |
| DOB (Reg) | REG-DOB-TYPE-SELECT, REG-DOB-PLAN-EXAM, REG-DOB-PROF-CERT, REG-DOB-AUDIT, REG-DOB-FEE-REVIEW, REG-DOB-FINAL-REVIEW | 12 | ~30 |
| FDNY (Reg) | REG-FDNY-FEE-REVIEW, REG-FDNY-PLAN-EXAM | 4 | ~10 |
| Contractor | CON-INITIATION, CON-ISSUES, CON-INSPECT | 6 | ~15 |
| Narrator-only | START, PM, LEND, BANK, INVESTOR, CHEAT, FINISH | 14 | ~30 |
| **Total** | **27 spaces** | **54 rows** | **~130 snippets** |

### Card Descriptions (CARDS_EXPANDED.csv)
- **404 cards** with descriptions — not tied to character voice
- **No rewrite needed for Phase 1** — cards stay in third-person
- Future enhancement: card play could trigger a brief character quip

---

## 4. Integration Points

### Files to Modify

| File | Change |
|------|--------|
| `src/services/SpeechService.ts` | **NEW** — Web Speech API wrapper |
| `src/types/SpeechTypes.ts` | **NEW** — VoiceProfile, SpeechState interfaces |
| `src/components/modals/shared/ModalBase.tsx` | Add speech control buttons to header; accept `speechProfile` prop |
| `src/components/modals/SpaceInfoModal.tsx` | Pass character profile; trigger speech on open |
| `src/components/modals/ChoiceModal.tsx` | Trigger narrator/character speech; grey out choices until speech done or skipped |
| `src/components/modals/DiceResultModal.tsx` | Brief narrator line on result reveal |
| `src/components/modals/CardModal.tsx` | Optional: short quip when card drawn |
| `src/components/layout/GameLayout.tsx` | Initialize SpeechService; pass mute state down |
| `public/data/CLEAN_FILES/SPACE_CONTENT.csv` | Rewritten text (first-person POV per character) |

### New Props

```
ModalBase:     + speechProfile?: VoiceProfile | null
               + onSpeechEnd?: () => void
               + speechText?: string

ChoiceModal:   + choicesLocked?: boolean  (greyed until speech ends)

SpaceInfoModal: + characterName?: string
                + characterRole?: string
```

### Lifecycle Hook

```
useModalSpeech(speechText, profile, isOpen) → { isSpeaking, stop, replay, muted, toggleMute }
```

Custom hook that:
- Calls `SpeechService.speak()` when `isOpen` transitions to `true`
- Cancels speech when modal closes
- Returns state for UI controls

---

## 5. Phased Rollout

### Phase 1 — Proof of Concept (6 spaces, critical path)

Every player traverses these spaces:

1. **OWNER-SCOPE-INITIATION** — Owner voice
2. **OWNER-FUND-INITIATION** — Owner voice
3. **ARCH-INITIATION** — Architect voice
4. **ENG-INITIATION** — Engineer voice
5. **REG-DOB-PLAN-EXAM** — DOB Examiner voice
6. **CON-INITIATION** — Contractor voice

Covers all 6 character voices + Narrator. **12 rows** (First + Subsequent), **~30 text snippets** to rewrite.

### Phase 2 — Remaining Core Spaces
- ARCH-FEE-REVIEW, ARCH-SCOPE-CHECK
- ENG-FEE-REVIEW, ENG-SCOPE-CHECK
- OWNER-DECISION-REVIEW
- REG-DOB-FEE-REVIEW, REG-DOB-TYPE-SELECT
- CON-ISSUES, CON-INSPECT

### Phase 3 — Full Coverage
- All REG-DOB and REG-FDNY spaces
- PM, LEND, BANK, INVESTOR, CHEAT
- START tutorial, FINISH celebration
- Card draw quips (stretch goal)
- TV "Player X's turn" announcement (stretch goal)

---

## 6. Effort Estimate

### Dev Work

| Task | Size |
|------|------|
| SpeechService + types | Small (~150 lines) |
| `useModalSpeech` hook | Small (~60 lines) |
| ModalBase speech controls (stop/replay/mute) | Small |
| Character identity badge component | Small |
| ChoiceModal integration (lock choices until speech) | Medium |
| SpaceInfoModal / DiceResultModal integration | Small |
| GameLayout initialization + mute persistence | Small |
| **Total dev work** | **~1-2 sessions** |

### Content Work

| Task | Size |
|------|------|
| Phase 1: Rewrite 30 snippets (6 spaces) | Medium |
| Phase 2: Rewrite ~45 snippets (9 spaces) | Medium |
| Phase 3: Rewrite ~55 snippets (remaining) | Medium |
| **Total content work** | **~130 snippets across 3 phases** |

Content is the bottleneck — each snippet must be rewritten from third-person narrator ("The architect reviews...") to first-person character ("I've reviewed your drawings and..."). Creative writing work that needs review for voice consistency.

### Risk Factors
- **Browser support**: Web Speech API well-supported but voice quality varies by OS/browser. No server cost.
- **Mobile**: iOS Safari has quirks with speech synthesis; needs testing.
- **User preference**: Some players will immediately mute. Mute must be easy and persistent.
- **Performance**: `speechSynthesis` is lightweight; no impact on game performance.
- **Accessibility**: Speech adds audio but is never required — all text remains visible. Screen readers should not conflict.
