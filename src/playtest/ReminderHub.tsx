// src/playtest/ReminderHub.tsx
//
// Reminder options for the playtester landing page. Calendar, Bookmark, and
// PWA install are real. Browser Notifications stays a grayed-out placeholder
// (no push-capable service worker exists — see the approved plan for why).
// Email/text is real once SMTP_* env vars are configured (see mailer.js).

import React, { useEffect, useState } from 'react';
import { downloadICS, ReminderChoice } from './generateICS';
import { trackPlaytestEvent } from './playtestAnalytics';
import { isIOSSafari, isPwaInstallable, isPwaInstalled, promptPwaInstall } from './pwaInstall';
import { CARRIERS, sendRemindMe } from './remindMe';

const CALENDAR_OPTIONS: { choice: ReminderChoice; label: string }[] = [
  { choice: 'tonight', label: 'Tonight' },
  { choice: 'tomorrow-evening', label: 'Tomorrow Evening' },
  { choice: 'saturday-afternoon', label: 'Saturday Afternoon' },
  { choice: 'next-weekend', label: 'Next Weekend' },
];

const buttonBase: React.CSSProperties = {
  borderRadius: 8,
  padding: '0.6rem 1rem',
  fontSize: '0.9rem',
  cursor: 'pointer',
};

function GrayedOption({ label, reason }: { label: string; reason: string }): JSX.Element {
  return (
    <button
      type="button"
      disabled
      title={reason}
      style={{
        ...buttonBase,
        opacity: 0.45,
        cursor: 'not-allowed',
        border: '1px dashed #999',
        background: 'transparent',
      }}
    >
      {label} <span style={{ fontSize: '0.75rem' }}>(coming soon)</span>
    </button>
  );
}

function InstallAppOption(): JSX.Element {
  // The beforeinstallprompt event can arrive after this component mounts, so
  // poll briefly rather than reading pwaInstall's module state only once.
  const [installable, setInstallable] = useState(isPwaInstallable());
  const [installed, setInstalled] = useState(isPwaInstalled());

  useEffect(() => {
    const id = window.setInterval(() => {
      setInstallable(isPwaInstallable());
      setInstalled(isPwaInstalled());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  if (installed) {
    return <GrayedOption label="Installed as an app ✓" reason="Already installed" />;
  }

  if (installable) {
    return (
      <button
        type="button"
        onClick={() => { void promptPwaInstall(); }}
        style={{
          ...buttonBase,
          border: '1px solid #333',
          background: 'transparent',
        }}
      >
        📲 Install as an app
      </button>
    );
  }

  if (isIOSSafari()) {
    return (
      <GrayedOption
        label="Install as an app"
        reason='On iPhone/iPad: tap Share, then "Add to Home Screen"'
      />
    );
  }

  return <GrayedOption label="Install as an app" reason="Not available in this browser" />;
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: '0.5rem',
  fontSize: '0.9rem',
  flex: '1 1 160px',
};

function EmailTextOption(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [carrier, setCarrier] = useState(CARRIERS[0].value);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setStatus('sending');
    const result = await sendRemindMe(
      method === 'email' ? { method, email } : { method, phone, carrier }
    );
    if (result.ok) {
      setStatus('sent');
      trackPlaytestEvent('reminder_selected');
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Something went wrong');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...buttonBase, border: '1px solid #333', background: 'transparent' }}
      >
        ✉️ Email / text me
      </button>
    );
  }

  if (status === 'sent') {
    return (
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#1a7f37' }}>
        ✓ Sent{method === 'sms' ? ' — texts can take a few minutes, or may not arrive depending on your carrier' : ''}.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}
    >
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
        <label>
          <input
            type="radio"
            checked={method === 'email'}
            onChange={() => setMethod('email')}
          />{' '}
          Email
        </label>
        <label>
          <input
            type="radio"
            checked={method === 'sms'}
            onChange={() => setMethod('sms')}
          />{' '}
          Text
        </label>
      </div>

      {method === 'email' ? (
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="tel"
              required
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} style={inputStyle}>
              {CARRIERS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>
            Sent via your carrier's email-to-text gateway — some carriers block these, so it may not arrive.
          </p>
        </>
      )}

      {status === 'error' && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#c0392b' }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          ...buttonBase,
          border: 'none',
          background: '#007bff',
          color: 'white',
          alignSelf: 'flex-start',
          opacity: status === 'sending' ? 0.6 : 1,
        }}
      >
        {status === 'sending' ? 'Sending…' : 'Send reminder'}
      </button>
    </form>
  );
}

export function ReminderHub(): JSX.Element {
  const handleCalendar = (choice: ReminderChoice): void => {
    downloadICS(choice);
    trackPlaytestEvent('reminder_selected');
  };

  const handleBookmark = (): void => {
    trackPlaytestEvent('bookmark_click');
  };

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontWeight: 600 }}>Remind me later</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {CALENDAR_OPTIONS.map(opt => (
          <button
            key={opt.choice}
            type="button"
            onClick={() => handleCalendar(opt.choice)}
            style={{
              ...buttonBase,
              border: '1px solid #007bff',
              background: '#007bff',
              color: 'white',
            }}
          >
            📅 {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleBookmark}
        style={{
          ...buttonBase,
          border: '1px solid #333',
          background: 'transparent',
          alignSelf: 'flex-start',
        }}
      >
        🔖 Bookmark this page ({isMac ? 'Cmd' : 'Ctrl'}+D)
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
        <GrayedOption
          label="Browser Notification"
          reason="Coming soon — needs a background service to survive a closed tab"
        />
        <InstallAppOption />
      </div>

      <div style={{ marginTop: '0.25rem' }}>
        <EmailTextOption />
      </div>
    </div>
  );
}
