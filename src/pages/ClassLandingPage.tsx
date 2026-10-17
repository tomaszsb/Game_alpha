// src/pages/ClassLandingPage.tsx
//
// Landing page for students sent here by a teacher (first: a structural-engineering class).
// Its own React root from main.tsx when the pathname is /class, so it never triggers the
// game's auto-create (same reason as /challenge). "Start" sends the student to the normal
// game start.

import React from 'react';

const page: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '32px 16px',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  lineHeight: 1.5,
  color: '#1f2937',
};

export function ClassLandingPage(): JSX.Element {
  return (
    <main style={page} data-testid="class-landing">
      <h1 style={{ marginBottom: 8 }}>Unravel Codes</h1>
      <p style={{ fontSize: '1.1rem', marginTop: 0 }}>
        A board game about getting a building permitted and built in New York City.
      </p>

      <h2>Why you might like it</h2>
      <p>
        Before a single beam goes up, the project has to get through the city: plans, reviews,
        inspections, fees, and the people who sign off. You play the project manager. Every choice
        costs days and money, and the engineers' work only gets built if the paperwork gets through.
      </p>

      <h2>What to do</h2>
      <ol>
        <li>Press <strong>Start the game</strong> below.</li>
        <li>Play until the game ends. You do not have to win. You only have to reach the end.</li>
        <li>On the last screen, press <strong>Print certificate</strong> and save it as a PDF to show your teacher.</li>
      </ol>

      <p style={{ color: '#4b5563' }}>
        A full game takes a while. It plays best on a computer or tablet, and you can use your
        phone as the controller. Your game is saved, so you can come back to it.
      </p>

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
