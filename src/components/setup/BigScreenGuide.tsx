// src/components/setup/BigScreenGuide.tsx
//
// "Step 1: put the game on a big screen" - for a phone-first visitor (Farmingdale class,
// 2026-10-21: students opened the game on a phone, did not know the board needs a TV or laptop
// browser, nor how to open one). It REPLACES the old yellow "bigger screen" banner (same place,
// same phone-only trigger) rather than adding a layer, and it reuses the pieces that already
// exist: the TV's own game code, the Join box, the PC-on-a-phone route, and the loading-tip
// advice in index.html. Closed it is no taller than the banner it replaced; opening it is the
// student's own choice. The words live in constants/bigScreenCopy.ts so /challenge and /class
// say the same thing.

import React, { useRef, useState } from 'react';
import { colors } from '../../styles/theme';
import { IconPhone } from '../icons/SetupIcons';
import { BIG_SCREEN, TvKind } from '../../constants/bigScreenCopy';

interface BigScreenGuideProps {
  /** "Play alone on this phone" - the setup screen switches to PC mode. Omit on pages with no mode picker. */
  onPlayAlone?: () => void;
  /** "I see the code on the TV" - the setup screen opens its Join box. Omit where there is no Join box here. */
  onReady?: () => void;
}

const card: React.CSSProperties = {
  borderRadius: 10, padding: '0.6rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.82rem',
  lineHeight: 1.4, textAlign: 'left',
};

const linkButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer',
  color: colors.primary.dark, textDecoration: 'underline',
};

const bigButton: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '0.5rem 0.7rem',
  borderRadius: 8, border: `2px solid ${colors.secondary.border}`, background: 'white',
  color: colors.text.primary, font: 'inherit',
};

function Steps({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <ol style={{ margin: '0.4rem 0', paddingLeft: '1.2rem' }}>
      {items.map((s) => <li key={s} style={{ marginBottom: 3 }}>{s}</li>)}
    </ol>
  );
}

export function BigScreenGuide({ onPlayAlone, onReady }: BigScreenGuideProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TvKind | null>(null);
  const [showMakers, setShowMakers] = useState(false);
  const [maker, setMaker] = useState<string | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  if (!open) {
    return (
      <div role="status" data-testid="big-screen-card" style={{
        ...card, background: colors.warning.bg, border: `1px solid ${colors.warning.border}`, color: colors.warning.text,
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 2 }} aria-hidden="true"><IconPhone size="1.1rem" /></span>
          <span><b>{BIG_SCREEN.headline}</b> {BIG_SCREEN.body}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
          <button type="button" data-testid="big-screen-open" onClick={() => setOpen(true)}
            style={{ ...linkButton, fontWeight: 700 }}>{BIG_SCREEN.openButton}</button>
          {onPlayAlone && (
            <button type="button" data-testid="big-screen-alone" onClick={onPlayAlone} style={linkButton}>{BIG_SCREEN.playAloneButton}</button>
          )}
        </div>
        <div style={{ marginTop: '0.3rem', opacity: 0.85, fontSize: '0.75rem' }}>{BIG_SCREEN.desktopSiteHint}</div>
      </div>
    );
  }

  const steps = kind === 'stick' ? BIG_SCREEN.stepsStick : BIG_SCREEN.stepsBrowser;

  return (
    <div ref={guideRef} data-testid="big-screen-guide" style={{
      ...card, background: colors.primary.lighter, border: `1px solid ${colors.primary.main}`, color: colors.text.primary,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <b style={{ fontSize: '0.95rem' }}>{BIG_SCREEN.title}</b>
        <button type="button" onClick={() => { setOpen(false); setKind(null); }} style={linkButton}>Close</button>
      </div>

      {kind === null && (
        <>
          <p style={{ margin: '0.35rem 0 0.5rem' }}>{BIG_SCREEN.body} <b>{BIG_SCREEN.question}</b></p>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {(['browser', 'stick', 'none'] as TvKind[]).map((k) => (
              <button key={k} type="button" data-testid={`big-screen-${k}`} onClick={() => setKind(k)} style={bigButton}>
                <b>{BIG_SCREEN.options[k].label}</b>
                <div style={{ fontSize: '0.75rem', color: colors.text.secondary }}>{BIG_SCREEN.options[k].hint}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {kind !== null && (
        <div data-testid={`big-screen-answer-${kind}`}>
          <button type="button" onClick={() => setKind(null)} style={{ ...linkButton, marginTop: '0.3rem' }}>{BIG_SCREEN.back}</button>
          {kind !== 'none' && (
            <>
              <Steps items={steps} />
              {onReady
                ? <button type="button" data-testid="big-screen-ready" onClick={onReady}
                    style={{ ...bigButton, textAlign: 'center', fontWeight: 700, background: colors.primary.main, color: 'white', border: `2px solid ${colors.primary.main}` }}>{BIG_SCREEN.ready}</button>
                : <p style={{ margin: '0.3rem 0' }}>{BIG_SCREEN.readyElsewhere}</p>}
              {/* Folded away so the three steps stay the first thing on a small phone. */}
              <details data-testid="big-screen-stuck" style={{ marginTop: '0.6rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{BIG_SCREEN.stuckTitle}</summary>
                <p style={{ margin: '0.3rem 0 0.1rem' }}>{BIG_SCREEN.stuckInstall}</p>
                <p style={{ margin: '0.1rem 0' }}>{BIG_SCREEN.stuckOld}</p>
                <p style={{ margin: '0.5rem 0 0.1rem' }}><b>{BIG_SCREEN.laptopTitle}</b></p>
                <Steps items={BIG_SCREEN.laptop} />
              </details>
            </>
          )}
          {kind === 'none' && (
            <>
              <p style={{ margin: '0.4rem 0 0.1rem' }}>{BIG_SCREEN.stuckOld}</p>
              <p style={{ margin: '0.5rem 0 0.1rem' }}><b>{BIG_SCREEN.laptopTitle}</b></p>
              <Steps items={BIG_SCREEN.laptop} />
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '0.5rem' }}>
        <button type="button" data-testid="big-screen-makers-link" aria-expanded={showMakers}
          onClick={() => setShowMakers((v) => !v)} style={linkButton}>
          {showMakers ? BIG_SCREEN.makersHide : BIG_SCREEN.makersLink}
        </button>
        {showMakers && (
          <div data-testid="big-screen-makers" style={{ marginTop: '0.4rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: colors.text.secondary }}>{BIG_SCREEN.makersNote}</p>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              {BIG_SCREEN.makers.map((m) => (
                <div key={m.name}>
                  <button type="button" aria-expanded={maker === m.name} onClick={() => setMaker(maker === m.name ? null : m.name)}
                    style={{ ...bigButton, fontWeight: 700 }}>{m.name}</button>
                  {maker === m.name && <p style={{ margin: '0.25rem 0.2rem 0.1rem' }}>{m.steps}</p>}
                </div>
              ))}
              {/* Last line, so nobody is stuck: back to the question that names no brand. */}
              <button type="button" data-testid="big-screen-not-listed"
                onClick={() => { setShowMakers(false); setMaker(null); setKind(null); guideRef.current?.scrollIntoView?.({ block: 'start' }); }}
                style={{ ...bigButton, fontWeight: 700 }}>{BIG_SCREEN.notListed}</button>
            </div>
          </div>
        )}
      </div>

      {onPlayAlone && (
        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" data-testid="big-screen-alone-open" onClick={() => { onPlayAlone(); setOpen(false); setKind(null); }} style={linkButton}>
            {BIG_SCREEN.playAloneButton}
          </button>
        </div>
      )}
    </div>
  );
}
