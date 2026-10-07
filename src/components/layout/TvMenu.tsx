// src/components/layout/TvMenu.tsx
//
// The TV's header buttons in ONE menu (Manager brief Job 5, Tom 2026-10-07): Rules, Standings, History,
// Back to PC, Adjust screen size, Connect Phone, and the new Fast switch. Six always-on buttons crowded the
// header (the old comments there measure 625px for five of them); one "Menu" button leaves the board its
// room. Every item keeps its old label and does what the old button did. Wording is a first draft for Tom.

import React, { useState } from 'react';
import { ScreenSizeControl } from './ScreenSizeControl';
import { useGameSpeed } from '../../utils/gameSpeed';

export interface TvMenuProps {
  playing: boolean;
  buttonStyle: React.CSSProperties;
  showScoreboard: boolean;
  onToggleScoreboard: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  showQRPanel: boolean;
  onToggleQR: () => void;
  onOpenRules: () => void;
  onBackToPC: () => void;
  /** Runs when the screen-size panel opens (the lobby uses it to stop the first-use pulse). */
  onOpenScreenSize: () => void;
  /** Extra look for the screen-size item while it should pulse. */
  screenSizeStyle?: React.CSSProperties;
}

export function TvMenu(props: TvMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useGameSpeed();
  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '1rem', fontWeight: 600,
    background: 'transparent', color: '#1a202c', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  };
  const choose = (fn: () => void) => () => { fn(); setOpen(false); };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        data-testid="tv-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{ ...props.buttonStyle, backgroundColor: open ? 'rgba(255,255,255,0.4)' : props.buttonStyle.backgroundColor }}
      >
        ☰ Menu
      </button>
      {open && (
        <div
          role="menu"
          data-testid="tv-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1100, minWidth: 260, padding: 6,
            background: '#fff', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
          }}
        >
          <button type="button" role="menuitem" style={item} onClick={choose(props.onOpenRules)}>📋 Rules</button>
          <button type="button" role="menuitem" style={item} onClick={choose(props.onToggleScoreboard)}>
            📊 Standings{props.showScoreboard ? ' (showing)' : ''}
          </button>
          {props.playing && (
            <button type="button" role="menuitem" style={item} onClick={choose(props.onToggleHistory)}>
              📜 History{props.showHistory ? ' (showing)' : ''}
            </button>
          )}
          {props.playing && (
            <button type="button" role="menuitem" style={item} onClick={choose(props.onToggleQR)}>
              📱 Connect Phone{props.showQRPanel ? ' (showing)' : ''}
            </button>
          )}
          <ScreenSizeControl
            onOpen={props.onOpenScreenSize}
            style={{ ...item, ...(props.screenSizeStyle ?? {}) }}
          />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={speed === 'fast'}
            data-testid="game-speed-toggle"
            style={item}
            onClick={() => setSpeed(speed === 'fast' ? 'normal' : 'fast')}
            title="Fast shortens the pauses, glides and pop-up notes on this screen only"
          >
            ⚡ Speed: {speed === 'fast' ? 'Fast' : 'Normal'}
          </button>
          <button type="button" role="menuitem" style={item} onClick={props.onBackToPC}>🖥️ Back to PC</button>
        </div>
      )}
    </div>
  );
}
