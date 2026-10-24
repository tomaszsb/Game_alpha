// src/pages/ClassLandingPage.tsx
//
// Landing page for students sent here by a teacher (first: a structural-engineering class).
// Its own React root from main.tsx when the pathname is /class, so it never triggers the
// game's auto-create (same reason as /challenge). "Start" sends the student to the normal
// game start.

import React, { useEffect, useRef } from 'react';
import { trackPlaytestEvent } from '../playtest/playtestAnalytics';
import { IconBug } from '../components/icons/SetupIcons';
import { PhoneScreenWarning } from '../components/setup/PhoneScreenWarning';
import { useSchoolBranding, CLASSROOM_ID_PATTERN } from '../components/classroom/useSchoolBranding';
import { logoUrl } from '../components/classroom/schoolBrandingApi';

const page: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '32px 16px',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  lineHeight: 1.5,
  color: '#1f2937',
};

/** A teacher's class link can carry the classroom: /class?i=<classroom-id>. Anything else is ignored. */
function classroomFromAddress(): string | null {
  try {
    const id = new URLSearchParams(window.location.search).get('i');
    return id && CLASSROOM_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function ClassLandingPage(): JSX.Element {
  const classroomId = classroomFromAddress();
  const school = useSchoolBranding(classroomId);
  // Records the visit and, because trackPlaytestEvent reads ?src= / ?utm_campaign= and keeps it in
  // sessionStorage, tags every later event of this tab's game with the class link it came from
  // (/class?src=kosi). The Start link below must stay a same-tab link or that tag is lost.
  // It reuses the `landing_view` event, so /class and /challenge landings share that count.
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackPlaytestEvent('landing_view');
  }, []);

  return (
    <main style={page} data-testid="class-landing">
      {classroomId && school && (school.logoVersion || school.schoolName) && (
        <div data-testid="class-school" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {school.logoVersion && (
            <img
              src={logoUrl(classroomId, school.logoVersion)}
              alt={school.schoolName ? `${school.schoolName} logo` : 'School logo'}
              data-testid="class-school-logo"
              style={{ height: 56, maxWidth: 160, objectFit: 'contain' }}
            />
          )}
          {school.schoolName && <strong style={{ fontSize: '1.1rem' }}>{school.schoolName}</strong>}
        </div>
      )}
      <h1 style={{ marginBottom: 8 }}>Unravel Codes</h1>
      <p style={{ fontSize: '1.1rem', marginTop: 0 }}>
        A board game about getting a building permitted and built in New York City.
      </p>

      <h2>Why you might like it</h2>
      <p>
        Before a single beam goes up, the project has to get through the city: plans, reviews,
        inspections, fees, and the people who sign off. You play the project manager. Every choice
        costs days and money, and the engineers&apos; work only gets built if the paperwork gets through.
      </p>

      <h2>What to do (SUNY Farmingdale, courses 350 and 409)</h2>
      <ol>
        <li>Press <strong>Start the game</strong> below.</li>
        <li>
          <strong>Finish one entire game, win or lose.</strong> You do not have to win. You have to
          reach the end.
        </li>
        <li>
          Leave <strong>at least one comment</strong> with the bug button: a red round button
          {' '}
          <span
            data-testid="class-bug-sample"
            aria-hidden="true"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              borderRadius: '50%', background: '#dc3545', color: '#fff', verticalAlign: 'middle',
            }}
          >
            <IconBug size="1em" />
          </span>
          {' '}
          in the bottom-right corner of the game. Tap it, write what you noticed, and send.
        </li>
        <li>
          On the last screen, check your course (<strong>350</strong> or <strong>409</strong>), press{' '}
          <strong>Print certificate</strong>, and save it as a PDF. Your name on it is the name you
          used in the game.
        </li>
      </ol>

      <p style={{ color: '#4b5563' }}>
        A game takes about 30 minutes. It plays best on a computer or tablet, and you can use your
        phone as the controller. Your game is saved, so you can come back to it.
      </p>

      {/* Phone first? Same "Step 1: put the game on a big screen" words as the game's setup screen. */}
      <PhoneScreenWarning />

      <a
        href="/"
        data-testid="class-start"
        style={{
          display: 'inline-block',
          marginTop: 8,
          padding: '14px 28px',
          background: '#1e3a5f',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: '1.1rem',
          minHeight: 48,
          boxSizing: 'border-box',
        }}
      >
        Start the game
      </a>
    </main>
  );
}
