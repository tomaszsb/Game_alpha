import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScreenTypeMenu, currentRoleOf } from '../../../src/components/game/ScreenTypeMenu';
import { roleUrl, getStoredDeviceRole } from '../../../src/utils/deviceRole';

const style = {};

describe('currentRoleOf', () => {
  it('reads an explicit role=', () => {
    expect(currentRoleOf('https://x.test/?g=G1&p=P1&role=pc&mode=remote')).toBe('pc');
  });
  it('infers: mode=tv is a TV; a personal link is a phone; neither is the plain PC view', () => {
    expect(currentRoleOf('https://x.test/?g=G1&mode=tv')).toBe('tv');
    expect(currentRoleOf('https://x.test/?g=G1&p=P1')).toBe('phone');
    expect(currentRoleOf('https://x.test/?g=G1')).toBe('pc');
  });
});

describe('roleUrl — the host has no personal link', () => {
  it('pc without a player is the plain full view (no mode), not Remote', () => {
    const p = new URL(roleUrl('pc', 'https://x.test/?g=G1&mode=tv')).searchParams;
    expect(p.get('mode')).toBeNull();
    expect(p.get('role')).toBe('pc');
  });
});

describe('ScreenTypeMenu', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('opens a menu of what this screen is; the current one is ticked', () => {
    window.history.pushState({}, '', '/?g=G1&p=P1&role=phone');
    render(<ScreenTypeMenu buttonStyle={style} showLabel />);
    expect(screen.queryByTestId('screen-type-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('screen-type-button'));
    expect(screen.getByTestId('screen-type-menu')).toBeInTheDocument();
    expect(screen.getByTestId('screen-type-phone')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('screen-type-pc')).toHaveAttribute('aria-checked', 'false');
  });

  it('a screen with no personal link (the host) is only offered PC and TV', () => {
    window.history.pushState({}, '', '/?g=G1');
    render(<ScreenTypeMenu buttonStyle={style} showLabel />);
    fireEvent.click(screen.getByTestId('screen-type-button'));
    expect(screen.getByTestId('screen-type-pc')).toBeInTheDocument();
    expect(screen.getByTestId('screen-type-tv')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-type-phone')).toBeNull();
  });

  it('picking a role remembers it on this device', () => {
    window.history.pushState({}, '', '/?g=G1');
    // (jsdom can't really navigate; the role is remembered before the page reloads.)
    render(<ScreenTypeMenu buttonStyle={style} showLabel />);
    fireEvent.click(screen.getByTestId('screen-type-button'));
    fireEvent.click(screen.getByTestId('screen-type-tv'));
    expect(getStoredDeviceRole()).toBe('tv');
  });
});
