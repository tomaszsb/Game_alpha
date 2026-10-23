/**
 * BigScreenGuide.test.tsx
 *
 * "Step 1: put the game on a big screen" (v3.8.47). A phone-first student is asked what the
 * TV can do (never its brand), told the plain steps, and can reach brand steps only behind a
 * small link, in alphabetical order. Tom's rules, 2026-10-23.
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BigScreenGuide } from '../../../src/components/setup/BigScreenGuide';
import { BIG_SCREEN, GAME_ADDRESS } from '../../../src/constants/bigScreenCopy';

describe('BigScreenGuide', () => {
  afterEach(cleanup);

  it('closed: says a phone alone is not enough and offers the TV steps and playing alone', () => {
    const onPlayAlone = vi.fn();
    render(<BigScreenGuide onPlayAlone={onPlayAlone} />);
    expect(screen.getByRole('status')).toHaveTextContent(/phone alone is not enough/i);
    fireEvent.click(screen.getByTestId('big-screen-alone'));
    expect(onPlayAlone).toHaveBeenCalledTimes(1);
  });

  it('first question names no TV brand', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    const guide = screen.getByTestId('big-screen-guide');
    expect(guide).toHaveTextContent(/It has a web browser app/);
    expect(guide).toHaveTextContent(/I plug in a stick or box/);
    expect(guide).toHaveTextContent(/It has no browser/);
    for (const m of BIG_SCREEN.makers) expect(screen.queryByText(m.name)).toBeNull();
  });

  it('browser answer: three steps with the plain address, and "I see the code" calls onReady', () => {
    const onReady = vi.fn();
    render(<BigScreenGuide onReady={onReady} />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    fireEvent.click(screen.getByTestId('big-screen-browser'));
    expect(screen.getByTestId('big-screen-answer-browser')).toHaveTextContent(GAME_ADDRESS);
    fireEvent.click(screen.getByTestId('big-screen-ready'));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('without a Join box on the page it says where to type the code instead of a button', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    fireEvent.click(screen.getByTestId('big-screen-browser'));
    expect(screen.queryByTestId('big-screen-ready')).toBeNull();
    expect(screen.getByTestId('big-screen-answer-browser')).toHaveTextContent(/tap Join/);
  });

  it('no browser: laptop on HDMI, mirroring, and the 2021-or-older line', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    fireEvent.click(screen.getByTestId('big-screen-none'));
    const answer = screen.getByTestId('big-screen-answer-none');
    expect(answer).toHaveTextContent(/HDMI/);
    expect(answer).toHaveTextContent(/2021 or older cannot run this game/);
  });

  it('only TV Bro is named as a browser app, with the "we get nothing" line', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    fireEvent.click(screen.getByTestId('big-screen-browser'));
    const text = screen.getByTestId('big-screen-stuck').textContent ?? '';
    expect(text).toMatch(/TV Bro/);
    expect(text).toMatch(/we get nothing/);
    expect(text).toMatch(/cannot promise every TV works/);
    expect(text).not.toMatch(/Browsehere|Puffin|Silk|Chrome|Firefox/i);
  });

  it('TV makers sit behind a link, alphabetical, with the not-recommending line', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    expect(screen.queryByTestId('big-screen-makers')).toBeNull();
    fireEvent.click(screen.getByTestId('big-screen-makers-link'));
    const list = screen.getByTestId('big-screen-makers');
    expect(list).toHaveTextContent(/We are not recommending or selling any of them/);
    const names = BIG_SCREEN.makers.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const shown = screen.getAllByRole('button', { expanded: false }).map((b) => b.textContent).filter((t) => (names as string[]).includes(t ?? ''));
    expect(shown).toEqual(names);
  });

  it('"My TV isn’t listed" is the last maker line and returns to the question with no brand', () => {
    render(<BigScreenGuide />);
    fireEvent.click(screen.getByTestId('big-screen-open'));
    fireEvent.click(screen.getByTestId('big-screen-none'));
    fireEvent.click(screen.getByTestId('big-screen-makers-link'));
    const list = screen.getByTestId('big-screen-makers');
    const last = list.querySelectorAll('button')[BIG_SCREEN.makers.length];
    expect(last).toBe(screen.getByTestId('big-screen-not-listed'));
    expect(last).toHaveTextContent(/isn.t listed/);
    fireEvent.click(last);
    expect(screen.queryByTestId('big-screen-makers')).toBeNull();
    expect(screen.queryByTestId('big-screen-answer-none')).toBeNull();
    expect(screen.getByTestId('big-screen-guide')).toHaveTextContent(/What can your TV do\?/);
  });

  it('Apple TV and Google TV words claim only what their official pages support', () => {
    const apple = BIG_SCREEN.makers.find((m) => m.name === 'Apple TV')!.steps;
    const google = BIG_SCREEN.makers.find((m) => m.name === 'Google TV')!.steps;
    expect(apple).toMatch(/AirPlay/);
    expect(apple).not.toMatch(/no web browser/i);
    expect(google).toMatch(/cast a Chrome tab/);
  });
});
