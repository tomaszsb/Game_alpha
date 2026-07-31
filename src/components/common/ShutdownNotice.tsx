// src/components/common/ShutdownNotice.tsx
//
// Deploy-update warning (TODO "📣 Active — deploy-update warning", scope
// narrowed 2026-07-10). NOT a general host-message/chat feature — this is
// the one fixed, canned notice shown when the maintainer deploys a new
// version: the server broadcasts `server_shutdown_notice` (see
// server.js's shutdown()) to every room right before it restarts, and this
// component shows a dismissible banner with that room's own rejoin code.
//
// Self-subscribing (owns its WebSocketSyncService subscription and
// dismissed/gameId state) so it can be dropped into any host view —
// GameLayout's phone view, GameLayout's desktop view, and TVDisplay — with
// a single `<ShutdownNotice />`, instead of each host wiring its own
// listener. `position: fixed` so placement in the DOM tree doesn't matter.
//
// Visual pattern matches GameLayout's existing WebSocket reconnect banner
// (sticky/fixed colored bar, plain text + emoji marker) rather than
// inventing new banner styling. Copy register: this is maintenance/meta
// communication, not NPC dialogue, so it does NOT use the space-NPC voice
// register (see docs/core/CLAUDE.md's voice rule) — it reads the same way
// the reconnect banner and the "Beta" footer do: direct, out-of-fiction,
// plain language. No promised countdown number: the server broadcasts once
// and the actual restart timing depends on Docker/deploy.sh, which isn't
// precisely predictable client-side.

import React, { useEffect, useState } from 'react';
import { getWebSocketService } from '../../services/WebSocketSyncService';

export function ShutdownNotice(): JSX.Element | null {
  const [gameId, setGameId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return getWebSocketService().onShutdownNotice((id) => {
      setGameId(id);
      setDismissed(false);
      setCopied(false);
    });
  }, []);

  if (!gameId || dismissed) return null;

  // Tap-to-copy: no auto-write on show (writeText needs a secure context
  // and, in some browsers, a user gesture — an unprompted write can fail
  // silently or throw). The rejection is swallowed rather than surfaced:
  // some embedded/insecure contexts reject the call, and the code is
  // already readable in the banner text as a fallback.
  const handleCopy = () => {
    navigator.clipboard
      .writeText(gameId)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  };

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '10px 40px 10px 16px',
        backgroundColor: '#fff3cd',
        color: '#856404',
        borderBottom: '1px solid #ffc107',
        fontSize: '14px',
        fontWeight: 600,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>
        🛠️ This game is in beta — we’re pushing an update now. If you get
        disconnected, rejoin with game code{' '}
        <button
          type="button"
          onClick={handleCopy}
          title="Tap to copy"
          aria-label={copied ? 'Game code copied to clipboard' : 'Copy game code to clipboard'}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            fontWeight: 700,
            color: 'inherit',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {gameId}
        </button>
        {copied ? ' — Copied!' : '.'}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notice"
        style={{
          position: 'absolute',
          right: '10px',
          background: 'none',
          border: 'none',
          color: 'inherit',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '2px 6px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
