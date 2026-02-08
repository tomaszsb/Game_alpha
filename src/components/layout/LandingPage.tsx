// src/components/layout/LandingPage.tsx
// Landing page with mode selection - TV remote friendly
// Shows PC | TV options when visiting without parameters

import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';

interface LandingPageProps {
  onSelectMode: (mode: 'pc' | 'tv') => void;
}

/**
 * LandingPage - Entry point for the game with mode selection
 *
 * Designed for TV remote navigation:
 * - Large, focusable buttons
 * - Arrow key navigation
 * - High contrast, readable from distance
 */
export function LandingPage({ onSelectMode }: LandingPageProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modes = [
    {
      id: 'pc' as const,
      icon: '🖥️',
      title: 'Play on Computer',
      description: 'Host a new game or join an existing one from your computer',
      color: colors.primary.main,
    },
    {
      id: 'tv' as const,
      icon: '📺',
      title: 'Play on TV',
      description: 'Same as computer, but optimized for a large screen display',
      color: '#9c27b0',
    },
  ];

  // Keyboard navigation for TV remotes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : modes.length - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          setSelectedIndex(prev => (prev < modes.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
        case ' ':
          onSelectMode(modes[selectedIndex].id);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex]);

  return (
    <div style={styles.container}>
      {/* Background gradient */}
      <div style={styles.background} />

      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Unravel Codes</h1>
        <p style={styles.subtitle}>The Construction Project Management Game</p>
      </header>

      {/* Mode selection */}
      <main style={styles.main}>
        <h2 style={styles.selectTitle}>How are you playing?</h2>

        <div style={styles.modeGrid}>
          {modes.map((mode, index) => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                ...styles.modeCard,
                borderColor: selectedIndex === index ? mode.color : 'transparent',
                backgroundColor: selectedIndex === index ? `${mode.color}15` : 'white',
                transform: selectedIndex === index ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span style={styles.modeIcon}>{mode.icon}</span>
              <span style={{ ...styles.modeTitle, color: mode.color }}>
                {mode.title}
              </span>
              <span style={styles.modeDescription}>{mode.description}</span>
            </button>
          ))}
        </div>

        <p style={styles.hint}>
          Use arrow keys to navigate, Enter to select
        </p>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>© 2026 Unravel Codes</span>
        <span style={styles.footerDot}>•</span>
        <span>A game about construction project management</span>
      </footer>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${colors.primary.light} 0%, ${colors.background.secondary} 50%, ${colors.secondary.light} 100%)`,
    zIndex: -1,
  },
  header: {
    textAlign: 'center',
    padding: '1.5vh 2rem 1vh',
    flexShrink: 0,
  },
  title: {
    fontSize: 'clamp(1.5rem, 4vh, 3rem)',
    fontWeight: 'bold',
    color: colors.primary.main,
    margin: 0,
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  subtitle: {
    fontSize: 'clamp(0.8rem, 2vh, 1.25rem)',
    color: colors.text.secondary,
    margin: '0.25rem 0 0',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 2rem',
    minHeight: 0,
  },
  selectTitle: {
    fontSize: 'clamp(1rem, 2.5vh, 1.5rem)',
    color: colors.text.primary,
    marginBottom: '2vh',
    flexShrink: 0,
  },
  modeGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 'clamp(1.5rem, 4vw, 4rem)',
    width: '100%',
    maxWidth: '800px',
    flex: 1,
    maxHeight: '50vh',
  },
  modeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1 1 0',
    maxWidth: '350px',
    minWidth: '150px',
    padding: 'clamp(1.5rem, 3vh, 3rem)',
    borderRadius: '16px',
    border: '4px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    backgroundColor: 'white',
  },
  modeIcon: {
    fontSize: 'clamp(2.5rem, 10vh, 5rem)',
    marginBottom: 'clamp(0.5rem, 1.5vh, 1.5rem)',
  },
  modeTitle: {
    fontSize: 'clamp(1.1rem, 3vh, 1.75rem)',
    fontWeight: 'bold',
    marginBottom: 'clamp(0.25rem, 0.5vh, 0.5rem)',
  },
  modeDescription: {
    fontSize: 'clamp(0.7rem, 1.5vh, 1rem)',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  hint: {
    marginTop: '1.5vh',
    fontSize: 'clamp(0.7rem, 1.5vh, 0.9rem)',
    color: colors.text.muted,
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '0.75rem',
    color: colors.text.muted,
    fontSize: 'clamp(0.7rem, 1.5vh, 0.85rem)',
    flexShrink: 0,
  },
  footerDot: {
    opacity: 0.5,
  },
};
