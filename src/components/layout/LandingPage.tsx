// src/components/layout/LandingPage.tsx
// Landing page with mode selection - TV remote friendly
// Shows Host | TV | Join options when visiting without parameters

import React, { useState, useEffect, useRef } from 'react';
import { colors } from '../../styles/theme';

interface LandingPageProps {
  onSelectMode: (mode: 'host' | 'tv' | 'join') => void;
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
  const [gameCode, setGameCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const modes = [
    {
      id: 'host' as const,
      icon: '🎮',
      title: 'Host Game',
      description: 'Start a new game session and invite players',
      color: colors.primary.main,
    },
    {
      id: 'tv' as const,
      icon: '📺',
      title: 'TV Display',
      description: 'Show the game board on a TV or large screen',
      color: '#9c27b0',
    },
    {
      id: 'join' as const,
      icon: '📱',
      title: 'Join Game',
      description: 'Join an existing game as a player',
      color: colors.success.main,
    },
  ];

  // Keyboard navigation for TV remotes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showJoinInput) {
        if (e.key === 'Escape') {
          setShowJoinInput(false);
          setGameCode('');
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : modes.length - 1));
          break;
        case 'ArrowRight':
          setSelectedIndex(prev => (prev < modes.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : modes.length - 1));
          break;
        case 'ArrowDown':
          setSelectedIndex(prev => (prev < modes.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
        case ' ':
          handleModeSelect(modes[selectedIndex].id);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, showJoinInput]);

  // Focus input when join dialog opens
  useEffect(() => {
    if (showJoinInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showJoinInput]);

  const handleModeSelect = (mode: 'host' | 'tv' | 'join') => {
    if (mode === 'join') {
      setShowJoinInput(true);
    } else {
      onSelectMode(mode);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameCode.trim()) {
      // Navigate to player join URL
      const code = gameCode.trim().toUpperCase();
      window.location.href = `${window.location.origin}${window.location.pathname}?g=${code}&join=1`;
    }
  };

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
        <h2 style={styles.selectTitle}>Select Mode</h2>

        <div style={styles.modeGrid}>
          {modes.map((mode, index) => (
            <button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id)}
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

      {/* Join game dialog */}
      {showJoinInput && (
        <div style={styles.overlay} onClick={() => setShowJoinInput(false)}>
          <div style={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3 style={styles.dialogTitle}>Join Game</h3>
            <form onSubmit={handleJoinSubmit}>
              <label style={styles.inputLabel}>Enter Game Code:</label>
              <input
                ref={inputRef}
                type="text"
                value={gameCode}
                onChange={e => setGameCode(e.target.value.toUpperCase())}
                placeholder="e.g., G1"
                style={styles.input}
                maxLength={10}
                autoComplete="off"
              />
              <div style={styles.dialogButtons}>
                <button
                  type="button"
                  onClick={() => setShowJoinInput(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!gameCode.trim()}
                  style={{
                    ...styles.submitButton,
                    opacity: gameCode.trim() ? 1 : 0.5,
                  }}
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    gap: 'clamp(1rem, 3vw, 3rem)',
    width: '100%',
    maxWidth: '1200px',
    flex: 1,
    maxHeight: '50vh',
  },
  modeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1 1 0',
    maxWidth: '320px',
    minWidth: '150px',
    padding: 'clamp(1rem, 2vh, 2rem)',
    borderRadius: '16px',
    border: '4px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    backgroundColor: 'white',
  },
  modeIcon: {
    fontSize: 'clamp(2rem, 8vh, 4rem)',
    marginBottom: 'clamp(0.5rem, 1vh, 1rem)',
  },
  modeTitle: {
    fontSize: 'clamp(1rem, 3vh, 1.5rem)',
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
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '2rem',
    width: 'clamp(300px, 80vw, 400px)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  dialogTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: colors.primary.main,
    marginTop: 0,
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  inputLabel: {
    display: 'block',
    fontSize: '1rem',
    color: colors.text.secondary,
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textAlign: 'center',
    border: `2px solid ${colors.secondary.border}`,
    borderRadius: '8px',
    outline: 'none',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },
  dialogButtons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    flex: 1,
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    backgroundColor: colors.secondary.light,
    color: colors.text.primary,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: colors.success.main,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
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
