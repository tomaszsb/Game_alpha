// src/components/feedback/FeedbackButton.tsx
// Floating draggable bug report button with screenshot capture

import React, { useState, useRef, useCallback } from 'react';
// html2canvas is dynamically imported inside handleCapture so the ~400KB
// minified payload doesn't ship in the main bundle. It only loads when a
// player actually clicks the feedback button to take a screenshot.
import { ModalBase, modalButtonStyles } from '../modals/shared/ModalBase';
import { colors } from '../../styles/theme';
import { getGameStateAPIPath, getCurrentGameId } from '../../utils/networkDetection';
import { getConsoleLogs } from '../../utils/consoleCapture';
import { IconBug } from '../icons/SetupIcons';

interface FeedbackForm {
  whatDoing: string;
  whatWrong: string;
  extra: string;
  // Optional contact fields — populate only if you want a follow-up.
  // Per G159 feedback (2026-05-08): players asked for a way to be
  // contacted about resolution.
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

type SubmitState = 'idle' | 'capturing' | 'form' | 'submitting' | 'success' | 'error';

// Subset of the server's /api/games/:id/state response — only the fields
// fetchGameStateSummary reads. The full GameState shape is intentionally not
// imported here to keep this component's payload small and decoupled.
interface ServerStatePlayer {
  id: string;
  shortId?: string;
  name: string;
  currentSpace: string;
  visitType: string;
  money: number;
  hand?: string[];
  timeSpent: number;
}
interface ServerStateResponse {
  currentPlayerId?: string;
  turnNumber?: number;
  requiredActions?: number;
  completedActionCount?: number;
  hasPlayerRolledDice?: boolean;
  awaitingChoice?: { type: string } | null;
  players?: ServerStatePlayer[];
}
interface GameStateSummary {
  currentPlayerId?: string;
  turnNumber?: number;
  requiredActions?: number;
  completedActionCount?: number;
  hasPlayerRolledDice?: boolean;
  awaitingChoice: { type: string } | null;
  players: Array<{
    id: string;
    name: string;
    space: string;
    visitType: string;
    money: number;
    handSize: number;
    timeSpent: number;
  }>;
}

export function FeedbackButton(): JSX.Element {
  const [state, setState] = useState<SubmitState>('idle');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [form, setForm] = useState<FeedbackForm>({
    whatDoing: '', whatWrong: '', extra: '',
    contactName: '', contactEmail: '', contactPhone: ''
  });
  // fb:TODO-234 — console logs were originally opt-in (default off). v3.0.67:
  // default ON. A playtester filed reports believing the box was checked when
  // it had silently reverted (default-off + reset-after-submit), so every
  // report arrived with no logs — the one thing that would have pinned the bug.
  // The buffer is only error/warn lines (capped at 50), so the PII/verbosity
  // risk that motivated opt-in is low. Players can still untick it.
  const [includeConsole, setIncludeConsole] = useState(true);
  // Whether the just-submitted report actually carried a console log — surfaced
  // in the success toast so the reporter knows, instead of guessing.
  const [submittedWithLogs, setSubmittedWithLogs] = useState(false);
  const [showFullScreenshot, setShowFullScreenshot] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Snapshot the console-capture state at the moment the modal opens
  // so the reporter sees exactly what will be sent. Refreshed each
  // time handleCapture runs (i.e. each new bug submission).
  const [captureSummary, setCaptureSummary] = useState<{ errors: number; warns: number } | null>(null);

  // Drag state
  const [position, setPosition] = useState({ bottom: 20, right: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startBottom: number; startRight: number; moved: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Hide button during capture
  const isVisible = state !== 'capturing';

  const getApiBase = useCallback(() => {
    const apiPath = getGameStateAPIPath();
    // Extract base URL from the game state path (e.g., "http://host:3001/api/games/G1/state" -> "http://host:3001")
    const match = apiPath.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : '';
  }, []);

  const handleCapture = useCallback(async () => {
    setState('capturing');

    // Small delay so the button hides before capture
    await new Promise(r => setTimeout(r, 100));

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1, // 1x scale to keep file size manageable
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshot(dataUrl);
      // Snapshot console buffer state for the modal preview.
      const logs = getConsoleLogs();
      setCaptureSummary({
        errors: logs.filter(l => l.level === 'error').length,
        warns: logs.filter(l => l.level === 'warn').length,
      });
      setState('form');
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      // Open form anyway, just without screenshot
      setScreenshot(null);
      const logs = getConsoleLogs();
      setCaptureSummary({
        errors: logs.filter(l => l.level === 'error').length,
        warns: logs.filter(l => l.level === 'warn').length,
      });
      setState('form');
    }
  }, []);

  // Fetch a lightweight game state snapshot for the feedback report
  const fetchGameStateSummary = useCallback(async (): Promise<GameStateSummary | null> => {
    const gameId = getCurrentGameId() || new URLSearchParams(window.location.search).get('g');
    if (!gameId) return null;

    try {
      const response = await fetch(`${getApiBase()}${getGameStateAPIPath(gameId)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;
      const state = await response.json() as ServerStateResponse;

      // Extract only what's needed for debugging (no hand contents or large arrays)
      return {
        currentPlayerId: state.currentPlayerId,
        turnNumber: state.turnNumber,
        requiredActions: state.requiredActions,
        completedActionCount: state.completedActionCount,
        hasPlayerRolledDice: state.hasPlayerRolledDice,
        awaitingChoice: state.awaitingChoice ? { type: state.awaitingChoice.type } : null,
        players: (state.players || []).map(p => ({
          id: p.shortId || p.id,
          name: p.name,
          space: p.currentSpace,
          visitType: p.visitType,
          money: p.money,
          handSize: (p.hand || []).length,
          timeSpent: p.timeSpent,
        })),
      };
    } catch {
      return null;
    }
  }, [getApiBase]);

  const handleSubmit = useCallback(async () => {
    if (!form.whatDoing.trim() || !form.whatWrong.trim()) return;

    setState('submitting');
    setErrorMsg('');

    const urlParams = new URLSearchParams(window.location.search);
    const metadata = {
      userAgent: navigator.userAgent,
      // Kept as-is (the LAYOUT viewport) — every historical report means this
      // by `screenSize`, so the name doesn't change under the dashboard.
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      // The three fields below exist because `screenSize` alone was actively
      // misleading on TVs. fb:93449bf2 came from a genuine 4K panel reporting
      // `screenSize: "960x540"`, which reads as "a low-resolution screen" and
      // is not: the panel is 3840x2160 and every glyph is drawn at 4 device
      // pixels per layout pixel. What's small is the LAYOUT BUDGET, not the
      // picture. Without devicePixelRatio there is no way to tell that TV
      // apart from an actual 960x540 display, and a session spent two rounds
      // inferring the ratio rather than reading it. `screenPixels` is the
      // screen (not the window) in layout px; `physicalPixels` is what the
      // panel actually has. Guarded because jsdom and older WebViews leave
      // parts of `screen` undefined.
      devicePixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
      screenPixels: window.screen?.width ? `${window.screen.width}x${window.screen.height}` : null,
      physicalPixels: window.screen?.width && window.devicePixelRatio
        ? `${Math.round(window.screen.width * window.devicePixelRatio)}x${Math.round(window.screen.height * window.devicePixelRatio)}`
        : null,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      gameId: getCurrentGameId() || urlParams.get('g') || 'none',
      playerId: urlParams.get('p') || urlParams.get('playerId') || 'none',
      // Stamp the deploy that produced this report so the dashboard can tell
      // a fresh bug from a stale one filed against pre-fix code.
      // Both fields come from Vite `define` at build time (vite.config.ts).
      version: typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : 'unknown',
      gitCommit: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    };

    // Collect diagnostic data in parallel
    const [gameState] = await Promise.all([
      fetchGameStateSummary(),
    ]);

    const consoleLogs = includeConsole ? getConsoleLogs() : [];
    // Record what actually went out so the success toast can confirm it.
    setSubmittedWithLogs(consoleLogs.length > 0);

    try {
      // Build optional contact block — only included if any field is set.
      const contactName = form.contactName.trim();
      const contactEmail = form.contactEmail.trim();
      const contactPhone = form.contactPhone.trim();
      const contact = (contactName || contactEmail || contactPhone)
        ? { name: contactName, email: contactEmail, phone: contactPhone }
        : undefined;

      const response = await fetch(`${getApiBase()}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshot,
          whatDoing: form.whatDoing.trim(),
          whatWrong: form.whatWrong.trim(),
          extra: form.extra.trim(),
          contact,
          metadata,
          consoleLogs,
          gameState,
        }),
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      setState('success');
      setTimeout(() => {
        setState('idle');
        setForm({ whatDoing: '', whatWrong: '', extra: '', contactName: '', contactEmail: '', contactPhone: '' });
        setIncludeConsole(true); // back to the new default-on
        setScreenshot(null);
        setCaptureSummary(null);
      }, 2200);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMsg('Failed to submit. Please try again.');
      setState('form');
    }
    // includeConsole MUST be a dependency: without it, ticking the box after the
    // last form keystroke leaves handleSubmit closed over a stale (false) value,
    // silently dropping the console log even though the box looks checked. This
    // was a contributing cause of reports arriving with no logs (v3.0.67 fix).
  }, [form, screenshot, includeConsole, getApiBase, fetchGameStateSummary]);

  const handleCancel = useCallback(() => {
    setState('idle');
    setForm({ whatDoing: '', whatWrong: '', extra: '', contactName: '', contactEmail: '', contactPhone: '' });
    setScreenshot(null);
    setCaptureSummary(null);
    setShowFullScreenshot(false);
  }, []);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startBottom: position.bottom,
      startRight: position.right,
      moved: false,
    };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
    }

    const newRight = Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startRight - dx));
    const newBottom = Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startBottom + dy));

    setPosition({ bottom: newBottom, right: newRight });
  }, []);

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    const wasDrag = dragRef.current?.moved;
    dragRef.current = null;
    setIsDragging(false);

    if (!wasDrag) {
      handleCapture();
    }
  }, [handleCapture]);

  // Textarea style
  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '70px',
    padding: '10px',
    fontSize: '14px',
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: '6px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: '600',
    fontSize: '14px',
    color: colors.text.primary,
    marginBottom: '4px',
  };

  // Modal footer
  const modalFooter = state === 'form' ? (
    <>
      <button style={modalButtonStyles.secondary} onClick={handleCancel}>Cancel</button>
      <button
        style={{
          ...modalButtonStyles.primary,
          opacity: (!form.whatDoing.trim() || !form.whatWrong.trim()) ? 0.5 : 1,
          cursor: (!form.whatDoing.trim() || !form.whatWrong.trim()) ? 'not-allowed' : 'pointer',
        }}
        onClick={handleSubmit}
        disabled={!form.whatDoing.trim() || !form.whatWrong.trim()}
      >
        Submit Report
      </button>
    </>
  ) : undefined;

  return (
    <>
      {/* Floating bug button */}
      {isVisible && state !== 'form' && state !== 'success' && (
        <button
          ref={buttonRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'fixed',
            bottom: `${position.bottom}px`,
            right: `${position.right}px`,
            zIndex: 2500,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#dc3545',
            color: 'white',
            fontSize: '22px',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            opacity: isDragging ? 1 : 0.6,
            transition: isDragging ? 'none' : 'opacity 0.2s',
            touchAction: 'none',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.opacity = '0.6'; }}
          title="Report a Bug"
        >
          <IconBug size="1.3em" />
        </button>
      )}

      {/* Feedback form modal */}
      <ModalBase
        isOpen={state === 'form' || state === 'submitting'}
        onClose={state === 'submitting' ? () => {} : handleCancel}
        title="Report a Bug"
        emoji="🐛"
        footer={modalFooter}
        maxWidth="520px"
      >
        {/* Screenshot preview */}
        {screenshot && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Screenshot captured:</label>
            <img
              src={screenshot}
              alt="Screenshot"
              onClick={() => setShowFullScreenshot(true)}
              style={{
                width: '100%',
                maxHeight: '150px',
                objectFit: 'contain',
                borderRadius: '6px',
                border: `1px solid ${colors.secondary.border}`,
                cursor: 'pointer',
              }}
            />
            <div style={{ fontSize: '12px', color: '#495057', marginTop: '4px' }}>
              Click to enlarge
            </div>
          </div>
        )}

        {/* Diagnostic capture summary — shows the reporter what's being
            attached (screenshot + game state always; console log opt-in). */}
        {captureSummary && (
          <div style={{
            marginBottom: '14px',
            padding: '8px 10px',
            backgroundColor: '#f8f9fa',
            borderLeft: `3px solid ${colors.secondary.border}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: '#495057',
          }}>
            <strong>Always included:</strong> screenshot · game state snapshot
            {includeConsole && (
              <span>
                {' · '}console log ({captureSummary.errors} error{captureSummary.errors !== 1 ? 's' : ''}, {captureSummary.warns} warning{captureSummary.warns !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ color: colors.danger.main, marginBottom: '12px', fontSize: '14px' }}>
            {errorMsg}
          </div>
        )}

        {/* Form fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>What were you trying to do? *</label>
            <textarea
              style={textareaStyle}
              value={form.whatDoing}
              onChange={(e) => setForm(f => ({ ...f, whatDoing: e.target.value }))}
              placeholder="e.g. I was trying to play a card during my turn..."
              disabled={state === 'submitting'}
            />
          </div>

          <div>
            <label style={labelStyle}>What went wrong or what did you expect instead? *</label>
            <textarea
              style={textareaStyle}
              value={form.whatWrong}
              onChange={(e) => setForm(f => ({ ...f, whatWrong: e.target.value }))}
              placeholder="e.g. The card didn't do anything and the button disappeared..."
              disabled={state === 'submitting'}
            />
          </div>

          <div>
            <label style={labelStyle}>Anything else? (optional)</label>
            <textarea
              style={{ ...textareaStyle, minHeight: '50px' }}
              value={form.extra}
              onChange={(e) => setForm(f => ({ ...f, extra: e.target.value }))}
              placeholder="Any other details that might help..."
              disabled={state === 'submitting'}
            />
          </div>

          {/* Optional: include browser console log */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#495057' }}>
            <input
              type="checkbox"
              checked={includeConsole}
              onChange={(e) => setIncludeConsole(e.target.checked)}
              disabled={state === 'submitting'}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>
              <strong>Include browser console log</strong>
              {captureSummary && includeConsole && (
                <span style={{ color: captureSummary.errors > 0 ? '#dc3545' : '#6c757d', marginLeft: '6px' }}>
                  ({captureSummary.errors} error{captureSummary.errors !== 1 ? 's' : ''}, {captureSummary.warns} warning{captureSummary.warns !== 1 ? 's' : ''})
                </span>
              )}
              <span style={{ color: '#aaa', marginLeft: '4px' }}>(helps debug JS errors)</span>
            </span>
          </label>

          {/* Optional contact fields — only fill in if you'd like a follow-up. */}
          <details style={{ marginTop: '4px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#495057', fontWeight: 600 }}>
              Want a reply about this report? (optional)
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div>
                <label style={labelStyle}>Name (optional)</label>
                <input
                  type="text"
                  style={{ ...textareaStyle, minHeight: 'auto', height: '36px' } as React.CSSProperties}
                  value={form.contactName}
                  onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="Your name"
                  disabled={state === 'submitting'}
                />
              </div>
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input
                  type="email"
                  style={{ ...textareaStyle, minHeight: 'auto', height: '36px' } as React.CSSProperties}
                  value={form.contactEmail}
                  onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="you@example.com"
                  disabled={state === 'submitting'}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone (optional)</label>
                <input
                  type="tel"
                  style={{ ...textareaStyle, minHeight: 'auto', height: '36px' } as React.CSSProperties}
                  value={form.contactPhone}
                  onChange={(e) => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="(optional)"
                  disabled={state === 'submitting'}
                />
              </div>
            </div>
          </details>
        </div>

        {state === 'submitting' && (
          <div style={{ textAlign: 'center', marginTop: '12px', color: '#495057' }}>
            Submitting report...
          </div>
        )}
      </ModalBase>

      {/* Success toast */}
      {state === 'success' && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 2500,
          backgroundColor: colors.success.main,
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontSize: '15px',
          fontWeight: '600',
          animation: 'modalSlideIn 0.2s ease-out',
          maxWidth: '280px',
        }}>
          <div>Thank you for the report!</div>
          <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '4px', opacity: 0.95 }}>
            {submittedWithLogs
              ? '✓ Console log included'
              : 'Sent without a console log'}
          </div>
        </div>
      )}

      {/* Full screenshot overlay */}
      {showFullScreenshot && screenshot && (
        <div
          onClick={() => setShowFullScreenshot(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '20px',
          }}
        >
          <img
            src={screenshot}
            alt="Screenshot (full size)"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
        </div>
      )}
    </>
  );
}
