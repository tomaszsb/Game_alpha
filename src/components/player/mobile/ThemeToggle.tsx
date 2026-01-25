// src/components/player/mobile/ThemeToggle.tsx
//
// Theme toggle component for switching between light and dark modes.
// Respects system preference and persists user choice to localStorage.
// Created: January 25, 2026

import React, { useState, useEffect, useCallback } from 'react';
import './ThemeToggle.css';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeToggleProps {
  /** Optional callback when theme changes */
  onThemeChange?: (theme: ThemeMode) => void;
  /** Show label next to toggle */
  showLabel?: boolean;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

const STORAGE_KEY = 'mobile-theme-preference';

/**
 * Get the effective theme based on system preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeMode): void {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

/**
 * ThemeToggle - Switch between light and dark modes.
 *
 * Features:
 * - Respects system preference by default
 * - Persists user preference to localStorage
 * - Smooth transition animation
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  onThemeChange,
  showLabel = true,
  compact = false
}) => {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialTheme = stored || 'system';
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setEffectiveTheme(initialTheme === 'system' ? getSystemTheme() : initialTheme);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newEffective = e.matches ? 'dark' : 'light';
        setEffectiveTheme(newEffective);
        document.documentElement.setAttribute('data-theme', newEffective);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Handle theme toggle
  const handleToggle = useCallback(() => {
    // Cycle through: system -> light -> dark -> system
    // Or for simple toggle: just switch between light and dark
    const newTheme: ThemeMode = effectiveTheme === 'dark' ? 'light' : 'dark';

    setTheme(newTheme);
    setEffectiveTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    onThemeChange?.(newTheme);
  }, [effectiveTheme, onThemeChange]);

  const isDark = effectiveTheme === 'dark';
  const containerClass = `theme-toggle ${compact ? 'theme-toggle--compact' : ''}`;

  return (
    <div className={containerClass} data-testid="theme-toggle">
      <button
        className="theme-toggle__button"
        onClick={handleToggle}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        aria-pressed={isDark}
        role="switch"
        data-testid="theme-toggle-button"
      >
        <span className="theme-toggle__track">
          <span
            className={`theme-toggle__thumb ${isDark ? 'theme-toggle__thumb--dark' : ''}`}
          >
            {isDark ? '🌙' : '☀️'}
          </span>
        </span>
      </button>
      {showLabel && (
        <span className="theme-toggle__label" data-testid="theme-toggle-label">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </div>
  );
};

/**
 * Hook to use theme in other components
 */
export function useTheme(): {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialTheme = stored || 'system';
    setThemeState(initialTheme);
    setEffectiveTheme(initialTheme === 'system' ? getSystemTheme() : initialTheme);
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    const effective = newTheme === 'system' ? getSystemTheme() : newTheme;
    setEffectiveTheme(effective);
    applyTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  return { theme, effectiveTheme, setTheme };
}
