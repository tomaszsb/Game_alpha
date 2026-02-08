// src/components/feedback/FeedbackButton.tsx
// Floating draggable bug report button with screenshot capture

import React, { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { ModalBase, modalButtonStyles } from '../modals/shared/ModalBase';
import { colors } from '../../styles/theme';
import { getGameStateAPIPath, getCurrentGameId } from '../../utils/networkDetection';

interface FeedbackForm {
  whatDoing: string;
  whatWrong: string;
  extra: string;
}

type SubmitState = 'idle' | 'capturing' | 'form' | 'submitting' | 'success' | 'error';

export function FeedbackButton(): JSX.Element {
  const [state, setState] = useState<SubmitState>('idle');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [form, setForm] = useState<FeedbackForm>({ whatDoing: '', whatWrong: '', extra: '' });
  const [showFullScreenshot, setShowFullScreenshot] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1, // 1x scale to keep file size manageable
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshot(dataUrl);
      setState('form');
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      // Open form anyway, just without screenshot
      setScreenshot(null);
      setState('form');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.whatDoing.trim() || !form.whatWrong.trim()) return;

    setState('submitting');
    setErrorMsg('');

    const urlParams = new URLSearchParams(window.location.search);
    const metadata = {
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      gameId: getCurrentGameId() || urlParams.get('g') || 'none',
      playerId: urlParams.get('p') || urlParams.get('playerId') || 'none',
    };

    try {
      const response = await fetch(`${getApiBase()}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshot,
          whatDoing: form.whatDoing.trim(),
          whatWrong: form.whatWrong.trim(),
          extra: form.extra.trim(),
          metadata,
        }),
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      setState('success');
      setTimeout(() => {
        setState('idle');
        setForm({ whatDoing: '', whatWrong: '', extra: '' });
        setScreenshot(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMsg('Failed to submit. Please try again.');
      setState('form');
    }
  }, [form, screenshot, getApiBase]);

  const handleCancel = useCallback(() => {
    setState('idle');
    setForm({ whatDoing: '', whatWrong: '', extra: '' });
    setScreenshot(null);
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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
          🐛
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
        }}>
          Thank you for the report!
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
