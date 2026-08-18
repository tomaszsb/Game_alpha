// src/components/setup/PlayerSetup.styles.ts

import React from 'react';
import { colors } from '../../styles/theme';

export const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    // height set via .us-setup-fullheight CSS class: 100vh fallback + 100dvh.
    // Dynamic viewport height (dvh) shrinks when the iOS keyboard appears so
    // input fields stay reachable inside the inner overflow:auto wrapper.
    // Pure inline styles can't express the fallback (only one value per key),
    // hence the className. <!-- fb:feedback-1779567253915-4b07b80a -->
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.purple.main} 100%)`,
    zIndex: -1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    // flexWrap lets the right-hand badge/button cluster (version, classroom,
    // game code, Share, settings gear) drop to its own row instead of
    // overflowing past the edge of the screen. On phone-width viewports
    // (~375px) the un-wrapped row was wider than the viewport itself, and
    // because the container clips with overflow:hidden, the Share button
    // and settings gear were rendered fully off-screen — present in the DOM
    // but literally impossible to see or tap. No effect at PC/TV widths,
    // where the row already fits on one line. fb:2c848b47.
    flexWrap: 'wrap' as const,
    rowGap: '0.4rem',
    padding: 'clamp(0.5rem, 1.5vh, 1rem) clamp(1rem, 3vw, 2rem)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(0.5rem, 1.5vw, 1rem)',
  },
  logo: {
    // Enlarged from clamp(40px, 6vh, 70px) — fb:7dbc2fcc ("feels naked") —
    // paired with the glow/wobble treatment above the header (search
    // us-hero-logo-wrap) so the existing brand mark reads as a proper hero
    // element instead of a small static icon.
    width: 'clamp(56px, 9vh, 96px)',
    height: 'auto',
  },
  title: {
    color: 'white',
    fontSize: 'clamp(1.15rem, 3vh, 2rem)',
    margin: 0,
    fontWeight: 'bold',
    letterSpacing: '0.01em',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 'clamp(0.7rem, 1.5vh, 1rem)',
    margin: 0,
  },
  // Shared "header chip" family — version, Game Code, Share, and the
  // settings gear all sit in the same header row and now use one consistent
  // treatment (translucent frosted pill, white text, thin white-ish border,
  // 8px radius, ~0.8rem text) instead of four different font/color/size
  // combinations. Maintainer feedback 2026-08-18: they read as unrelated
  // controls even though they're all header-level chrome. Share
  // (ShareGameButton.tsx) and the gear icon (PlayerSetup.tsx, inline) match
  // these values directly since they're separate components/elements.
  //
  // Height is pinned explicitly (36px + border-box) rather than left to
  // padding-derived sizing — padding alone still left the chips a few px
  // off from each other (maintainer follow-up, same date): versionInfo set
  // its own font-size so `lineHeight:1` measured against 0.8rem, while
  // gameCodeBadge had no font-size of its own (only its child spans did),
  // so its line-height measured against the inherited ambient size instead
  // — two different line-box heights from the "same" padding. An explicit
  // height sidesteps that entirely.
  versionInfo: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '36px',
    boxSizing: 'border-box' as const,
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: 'white',
    padding: '0 0.75rem',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px',
    whiteSpace: 'nowrap' as const,
  },
  versionCommit: {
    color: 'rgba(255,255,255,0.7)',
  },
  versionInSync: {
    color: '#22c55e',
    fontWeight: 'bold' as const,
  },
  versionBehind: {
    color: '#f59e0b',
    fontWeight: 'bold' as const,
  },
  gameCodeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    height: '36px',
    boxSizing: 'border-box' as const,
    padding: '0 0.75rem',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px',
  },
  gameCodeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8rem',
  },
  gameCodeValue: {
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    // fb:feedback-1782833653490-5470235b — default alignItems ('stretch')
    // forced the white panel card to always fill the entire remaining
    // viewport height, leaving a big empty gap below short content (e.g. 1-2
    // players). 'flex-start' lets the panel/settingsColumn size to their own
    // content instead; `maxHeight: '100%'` on each (below) still caps them so
    // tall content (TV mode, 4 players) is clamped and scrolls internally
    // rather than overflowing past the footer.
    alignItems: 'flex-start',
    gap: 'clamp(0.75rem, 2vw, 1.5rem)',
    padding: '0 clamp(1rem, 3vw, 2rem) clamp(0.5rem, 1vh, 1rem)',
    minHeight: 0,
    overflow: 'hidden',
  },
  qrColumn: {
    flex: '0 0 200px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    minWidth: 0,
  },
  panel: {
    flex: 1,
    background: 'white',
    borderRadius: '16px',
    padding: 'clamp(1rem, 2vh, 1.5rem)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    // minHeight: 0 is the missing piece that lets the flex:1 `playerListWrapper`
    // child shrink below its natural content height — without it, taller player
    // cards (4 players on TV, internal flex-wrap of QR section) push the panel
    // past its allotted flex height and the wrapper's `overflow: auto` never
    // kicks in. The Start Game block scrolls out of view at the bottom and the
    // user sees no scrollbar. v3.0.18 — fb:ffdddd29.
    minHeight: 0,
    // Caps growth at `main`'s available height now that `main.alignItems` is
    // 'flex-start' (panel hugs its own content instead of always stretching
    // full-height — fb:feedback-1782833653490-5470235b). When content is
    // short the panel is just as tall as it needs to be; when content is
    // tall (TV mode, 4 players) this clamp makes panel's height definite
    // again so the flex:1 + minHeight:0 wrapper above still scrolls
    // internally instead of overflowing past the footer.
    maxHeight: '100%',
    // Panel itself no longer needs overflow:auto since the inner wrapper now
    // properly scrolls. Keep `hidden` so the rounded-corners + boxShadow stay
    // clean if anything inside misbehaves.
    overflow: 'hidden',
    minWidth: 0,
  },
  settingsColumn: {
    flex: '0 0 280px',
    background: 'white',
    borderRadius: '16px',
    padding: 'clamp(1rem, 2vh, 1.5rem)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    // Same reasoning as `panel.maxHeight` above — with `main.alignItems:
    // 'flex-start'` this column no longer auto-stretches, so cap it to
    // `main`'s available height and let its own overflow:auto scroll
    // internally when its content (Admin Tools etc.) is tall.
    maxHeight: '100%',
    overflow: 'auto',
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.success.text,
    fontSize: 'clamp(1rem, 2.5vh, 1.5rem)',
    marginTop: 0,
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sectionTitleSmall: {
    color: colors.success.text,
    fontSize: 'clamp(0.9rem, 2vh, 1.2rem)',
    marginTop: 0,
    marginBottom: 'clamp(0.4rem, 1vh, 0.75rem)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  playerCount: {
    color: colors.text.primary,
    fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
    fontWeight: '500',
    margin: '0 0 clamp(0.5rem, 1vh, 1rem) 0',
  },
  playerListWrapper: {
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
    flex: 1,
    minHeight: 0,
    // fb:fc65c217 — TV browsers (and Comet, and many Chromium variants) hide
    // scrollbars when `overflow: auto`; they only appear on hover, which a
    // user with a TV remote can't trigger. `scroll` forces always-visible.
    // `scrollbarGutter: stable` reserves the gutter so toggling content
    // doesn't shift the layout. On TVs at 4 players the player cards form a
    // 2×2 grid that exceeds wrapper height; without a visible scrollbar the
    // user can't tell to scroll for the bottom row.
    overflow: 'scroll',
    scrollbarGutter: 'stable',
  },
  settingsBlock: {
    background: colors.secondary.bg,
    borderRadius: '12px',
    padding: 'clamp(0.75rem, 1.5vh, 1.25rem)',
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
  },
  label: {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: 'bold',
    color: colors.secondary.dark,
    fontSize: 'clamp(0.8rem, 1.5vh, 0.95rem)',
  },
  select: {
    width: '100%',
    padding: 'clamp(0.5rem, 1vh, 0.75rem)',
    border: `2px solid ${colors.secondary.light}`,
    borderRadius: '8px',
    fontSize: 'clamp(0.85rem, 1.5vh, 1rem)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  subOptions: {
    marginTop: '0.75rem',
    marginLeft: '1.5rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '8px',
    border: `1px solid ${colors.secondary.light}`,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
  },
  footer: {
    textAlign: 'center' as const,
    padding: 'clamp(0.4rem, 1vh, 0.75rem) 1rem',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 'clamp(0.7rem, 1.3vh, 0.85rem)',
    flexShrink: 0,
  },
};
