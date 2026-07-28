// src/playtest/ReminderHub.tsx
//
// The "Remind me later" flow for the playtester landing page. One consistent
// path for every channel: pick HOW (calendar / device alert / email / text),
// then pick WHEN (a preset, or a custom date & time). Calendar downloads an
// .ics; the other three are truly scheduled server-side for the chosen time
// (server/reminderScheduler.js), so they fire even with the tab closed.
//
// iOS Safari can't do Web Push from a browser tab (only from an installed
// Home-Screen app), so the "Phone alert" option there explains the Add-to-
// Home-Screen step inline instead of sitting dead — a disabled button's
// tooltip never shows on touch.

import React, { useState } from 'react';
import { downloadICSForDate, resolveWhen, ReminderChoice, ReminderWhen } from './generateICS';
import { trackPlaytestEvent } from './playtestAnalytics';
import { isPushSupported, schedulePushReminder } from './browserPush';
import { isIOSSafari } from './pwaInstall';
import { CARRIERS, sendRemindMe } from './remindMe';

type Method = 'calendar' | 'push' | 'email' | 'sms';
type Step = 'method' | 'when' | 'contact' | 'done';

const WHEN_PRESETS: { choice: ReminderChoice; label: string }[] = [
  { choice: 'tonight', label: 'Tonight' },
  { choice: 'tomorrow-evening', label: 'Tomorrow evening' },
  { choice: 'saturday-afternoon', label: 'Saturday afternoon' },
  { choice: 'next-weekend', label: 'Next weekend' },
];

const buttonBase: React.CSSProperties = {
  height: 44,
  borderRadius: 8,
  padding: '0 0.75rem',
  fontSize: '0.9rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  width: '100%',
  boxSizing: 'border-box',
};

const outlineBtn: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid #333',
  background: '#fff',
  color: '#333',
};

const primaryBtn: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid #007bff',
  background: '#007bff',
  color: '#fff',
};

const gridTwo: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.5rem',
};

const stepLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: '0 0 0.4rem',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: '0.55rem',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

function BackLink({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        color: '#007bff',
        cursor: 'pointer',
        fontSize: '0.8rem',
        padding: 0,
        alignSelf: 'flex-start',
      }}
    >
      ← Change
    </button>
  );
}

export function ReminderHub({ isPhone }: { isPhone: boolean }): JSX.Element {
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method | null>(null);
  const [when, setWhen] = useState<{ date: Date; label: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [pushHint, setPushHint] = useState('');

  // Custom date/time entry
  const [customValue, setCustomValue] = useState('');

  // Contact fields (email / text)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [carrier, setCarrier] = useState(CARRIERS[0].value);

  const alertLabel = isPhone ? '🔔 Phone alert' : '🔔 Browser alert';

  const reset = (): void => {
    setStep('method');
    setMethod(null);
    setWhen(null);
    setStatus('idle');
    setErrorMsg('');
    setDoneMsg('');
    setPushHint('');
    setCustomValue('');
  };

  const pickMethod = (m: Method): void => {
    setPushHint('');
    if (m === 'push' && !isPushSupported()) {
      // No Web Push in this browser. On iPhone/iPad Safari it works only from
      // an installed app, so tell them how; elsewhere point at email/text.
      setPushHint(
        isIOSSafari()
          ? 'On iPhone, first tap the Share button, then "Add to Home Screen" — open it from there and this alert will work. Or use Email or Text below.'
          : "This browser can't pop up alerts. Try Email or Text instead."
      );
      return;
    }
    setMethod(m);
    setStatus('idle');
    setErrorMsg('');
    setStep('when');
  };

  const runWhen = async (resolved: { date: Date; label: string }): Promise<void> => {
    setWhen(resolved);
    if (method === 'calendar') {
      downloadICSForDate(resolved.date);
      trackPlaytestEvent('reminder_selected');
      setDoneMsg(`Saved to your calendar for ${resolved.label}.`);
      setStep('done');
      return;
    }
    if (method === 'push') {
      setStatus('sending');
      const result = await schedulePushReminder(resolved.date);
      if (result.ok) {
        trackPlaytestEvent('reminder_selected');
        setDoneMsg(`We'll alert you ${resolved.label} — works even with this tab closed.`);
        setStep('done');
      } else {
        setStatus('error');
        setErrorMsg(result.error || 'Something went wrong');
      }
      return;
    }
    // email / sms need contact details next.
    setStep('contact');
  };

  const chooseWhen = (choice: ReminderChoice): void => {
    void runWhen(resolveWhen(choice));
  };

  const chooseCustom = (): void => {
    if (!customValue) return;
    // datetime-local has no timezone — parsed as local time, which is what the
    // visitor means. Guard against a past time.
    const date = new Date(customValue);
    if (Number.isNaN(date.getTime())) {
      setErrorMsg('That date didn\'t look right — try again.');
      return;
    }
    if (date.getTime() <= Date.now()) {
      setErrorMsg('Pick a time in the future.');
      return;
    }
    setErrorMsg('');
    void runWhen(resolveWhen({ custom: date } as ReminderWhen));
  };

  const sendContact = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!when || !method) return;
    setStatus('sending');
    const base = { whenLabel: when.label, sendAt: when.date.toISOString() };
    const result = await sendRemindMe(
      method === 'email'
        ? { method: 'email', email, ...base }
        : { method: 'sms', phone, carrier, ...base }
    );
    if (result.ok) {
      trackPlaytestEvent('reminder_selected');
      setDoneMsg(
        method === 'email'
          ? `We'll email you ${when.label}.`
          : `We'll text you ${when.label} — carrier gateways can be slow or drop it.`
      );
      setStep('done');
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Something went wrong');
    }
  };

  // --- Step: done ---------------------------------------------------------
  if (step === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Remind me later</p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1a7f37' }}>✓ {doneMsg}</p>
        <button
          type="button"
          onClick={reset}
          style={{ ...outlineBtn, width: 'auto', height: 38, alignSelf: 'flex-start' }}
        >
          Set another reminder
        </button>
      </div>
    );
  }

  // --- Step: contact (email / text) --------------------------------------
  if (step === 'contact' && when) {
    return (
      <form onSubmit={sendContact} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Remind me later</p>
        <BackLink onClick={() => { setStep('when'); setStatus('idle'); setErrorMsg(''); }} />
        <p style={stepLabel}>
          {method === 'email' ? 'Your email' : 'Your number'} · {when.label}
        </p>
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
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>
              Sent via your carrier’s email-to-text gateway — some carriers block these, so it may not arrive.
            </p>
          </>
        )}
        {status === 'error' && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#c0392b' }}>{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={status === 'sending'}
          style={{ ...primaryBtn, opacity: status === 'sending' ? 0.6 : 1 }}
        >
          {status === 'sending' ? 'Setting…' : 'Set reminder'}
        </button>
      </form>
    );
  }

  // --- Step: when ---------------------------------------------------------
  if (step === 'when') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Remind me later</p>
        <BackLink onClick={() => { setStep('method'); setStatus('idle'); setErrorMsg(''); }} />
        <p style={stepLabel}>2 · when</p>
        <div style={gridTwo}>
          {WHEN_PRESETS.map(p => (
            <button
              key={p.choice}
              type="button"
              disabled={status === 'sending'}
              onClick={() => chooseWhen(p.choice)}
              style={{ ...outlineBtn, opacity: status === 'sending' ? 0.6 : 1 }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            aria-label="Pick a date and time"
          />
          <button
            type="button"
            disabled={!customValue || status === 'sending'}
            onClick={chooseCustom}
            style={{ ...outlineBtn, width: 'auto', padding: '0 1rem', opacity: (!customValue || status === 'sending') ? 0.5 : 1 }}
          >
            Set
          </button>
        </div>
        {status === 'sending' && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Setting up your reminder…</p>
        )}
        {status === 'error' && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#c0392b' }}>{errorMsg}</p>
        )}
        {errorMsg && status !== 'error' && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#c0392b' }}>{errorMsg}</p>
        )}
      </div>
    );
  }

  // --- Step: method (default) --------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Remind me later{isPhone ? ' ' : ''}
          {isPhone && <span style={{ fontSize: '0.7rem', color: '#007bff', fontWeight: 400 }}>· recommended</span>}
        </p>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#777' }}>Pick how, then when.</p>
      </div>
      <p style={stepLabel}>1 · how</p>
      <div style={gridTwo}>
        <button type="button" onClick={() => pickMethod('calendar')} style={primaryBtn}>📅 Add to calendar</button>
        <button type="button" onClick={() => pickMethod('push')} style={outlineBtn}>{alertLabel}</button>
        <button type="button" onClick={() => pickMethod('email')} style={outlineBtn}>✉️ Email me</button>
        <button type="button" onClick={() => pickMethod('sms')} style={outlineBtn}>💬 Text me</button>
      </div>
      {pushHint && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', lineHeight: 1.4 }}>{pushHint}</p>
      )}
    </div>
  );
}
