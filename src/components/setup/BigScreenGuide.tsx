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
//
// v3.8.49: picture-first (Tom, 10-23: "a picture says a thousand words"). Every choice and
// every step is an icon plus a few words; the icons are the game's own inline SVG set
// (SetupIcons), not an emoji font, because smart-TV and phone browsers draw emoji differently.

import React, { useRef, useState } from 'react';
import { colors } from '../../styles/theme';
import {
  IconPhone, IconTV, IconGlobe, IconPlug, IconLaptop, IconKeyboard, IconShareScreen,
} from '../icons/SetupIcons';
import { BIG_SCREEN, TvKind, Step, StepIcon } from '../../constants/bigScreenCopy';

interface BigScreenGuideProps {
  /** "Play alone on this phone" - the setup screen switches to PC mode. Omit on pages with no mode picker. */
  onPlayAlone?: () => void;
  /** "I see the code on the TV" - the setup screen opens its Join box. Omit where there is no Join box here. */
  onReady?: () => void;
  /** Set when the guide is opened from the TV button itself (setup screen): it starts open, and Close folds it back into the button. */
  onClose?: () => void;
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
  display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', textAlign: 'left', cursor: 'pointer',
  padding: '0.45rem 0.7rem', borderRadius: 8, border: `2px solid ${colors.secondary.border}`, background: 'white',
  color: colors.text.primary, font: 'inherit',
};

const mono: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.8rem', background: colors.secondary.bg, padding: '1px 7px', borderRadius: 6,
  display: 'inline-block', marginTop: 2, wordBreak: 'break-all',
};

function Pic({ icon, size = '1.6rem' }: { icon: StepIcon; size?: string }): JSX.Element {
  const props = { size };
  switch (icon) {
    case 'tv': return <IconTV {...props} />;
    case 'keyboard': return <IconKeyboard {...props} />;
    case 'phone': return <IconPhone {...props} />;
    case 'plug': return <IconPlug {...props} />;
    case 'laptop': return <IconLaptop {...props} />;
    case 'share': return <IconShareScreen {...props} />;
    default: return <IconGlobe {...props} />;
  }
}

/** A round-cornered picture tile, the same blue wherever it appears. */
function Tile({ icon }: { icon: StepIcon }): JSX.Element {
  return (
    <span aria-hidden="true" style={{
      width: 44, height: 44, borderRadius: 10, background: colors.primary.light, color: colors.primary.dark,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}><Pic icon={icon} /></span>
  );
}

function Steps({ items, numbered = true }: { items: readonly Step[]; numbered?: boolean }): JSX.Element {
  return (
    <ol style={{ listStyle: 'none', margin: '0.4rem 0', padding: 0 }}>
      {items.map((s, i) => (
        <li key={s.text} style={{
          display: 'flex', gap: '0.65rem', alignItems: 'center', padding: '0.4rem 0',
          borderTop: i === 0 ? 'none' : `1px solid ${colors.secondary.border}`,
        }}>
          <Tile icon={s.icon} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{numbered ? `${i + 1}. ` : ''}{s.text}</div>
            {s.code && <code style={mono}>{s.code}</code>}
            {s.note && <div style={{ fontSize: '0.74rem', color: colors.text.secondary }}>{s.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BigScreenGuide({ onPlayAlone, onReady, onClose }: BigScreenGuideProps): JSX.Element {
  const [open, setOpen] = useState(!!onClose);
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
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 2 }} aria-hidden="true">
            <IconPhone size="1.1rem" /><IconTV size="1.3rem" />
          </span>
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
        <button type="button" onClick={() => { setKind(null); if (onClose) onClose(); else setOpen(false); }} style={linkButton}>Close</button>
      </div>

      {kind === null && (
        <>
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: colors.primary.dark, margin: '0.4rem 0 0.1rem' }}>
            <IconPhone size="2.2rem" /><span style={{ fontSize: '1.2rem' }}>+</span><IconTV size="2.8rem" />
          </div>
          <p style={{ margin: '0 0 0.15rem', textAlign: 'center', fontWeight: 700 }}>{BIG_SCREEN.pairTitle}</p>
          <p style={{ margin: '0 0 0.5rem', textAlign: 'center', color: colors.text.secondary }}>{BIG_SCREEN.body} <b>{BIG_SCREEN.question}</b></p>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {(['browser', 'stick', 'none'] as TvKind[]).map((k) => (
              <button key={k} type="button" data-testid={`big-screen-${k}`} onClick={() => setKind(k)} style={bigButton}>
                <Tile icon={BIG_SCREEN.options[k].icon} />
                <span>
                  <b>{BIG_SCREEN.options[k].label}</b>
                  {BIG_SCREEN.options[k].hint && <div style={{ fontSize: '0.74rem', color: colors.text.secondary }}>{BIG_SCREEN.options[k].hint}</div>}
                </span>
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
                    style={{ ...bigButton, justifyContent: 'center', fontWeight: 700, background: colors.primary.main, color: 'white', border: `2px solid ${colors.primary.main}` }}>{BIG_SCREEN.ready}</button>
                : <p style={{ margin: '0.3rem 0' }}>{BIG_SCREEN.readyElsewhere}</p>}
              {/* Folded away so the three steps stay the first thing on a small phone. */}
              <details data-testid="big-screen-stuck" style={{ marginTop: '0.6rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{BIG_SCREEN.stuckTitle}</summary>
                <p style={{ margin: '0.3rem 0 0.1rem' }}>{BIG_SCREEN.stuckInstall}</p>
                <p style={{ margin: '0.1rem 0' }}>{BIG_SCREEN.stuckOld}</p>
                <p style={{ margin: '0.5rem 0 0.1rem' }}><b>{BIG_SCREEN.laptopTitle}</b></p>
                <Steps items={BIG_SCREEN.laptop} numbered={false} />
              </details>
            </>
          )}
          {kind === 'none' && (
            <>
              <p style={{ margin: '0.4rem 0 0.1rem' }}>{BIG_SCREEN.stuckOld}</p>
              <Steps items={BIG_SCREEN.laptop} numbered={false} />
            </>
          )}
        </div>
      )}

      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: colors.text.secondary }}>{BIG_SCREEN.desktopSiteHint}</p>

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
          <button type="button" data-testid="big-screen-alone-open" onClick={() => { onPlayAlone(); setKind(null); if (onClose) onClose(); else setOpen(false); }} style={linkButton}>
            {BIG_SCREEN.playAloneButton}
          </button>
        </div>
      )}
    </div>
  );
}
