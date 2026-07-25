/**
 * DictionaryPanel.test.tsx
 *
 * fb:baa01a70 hardening — the embedded dashboard iframe must not strand the
 * player on "Loading intelligence from dashboard…" forever. jsdom never fires
 * iframe load events, which conveniently simulates the hung-network case: the
 * panel must fall back to the locally cached definition after the timeout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DictionaryPanel, EMBED_LOAD_TIMEOUT_MS } from '../../src/dictionary/components/DictionaryPanel';
import { DictionaryProvider } from '../../src/dictionary/context/DictionaryContext';
import { clearCache } from '../../src/dictionary/data/terms';

// CSV content that loadTerms can parse via the CSV fallback path
const csvContent = [
  'id,term,definition_technical,definition_simple,instructions,category,source,needs_review,aliases,related_terms,image_url,video_url,source_url,instagram_link',
  'underwriting,Underwriting,The process by which a bank evaluates project risk and sets loan terms.,How the bank decides your loan.,,Finance,game,false,,,,,,'
].join('\n');

describe('DictionaryPanel — embedded iframe timeout fallback (fb:baa01a70)', () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    // API JSON call fails (no json()), CSV fallback succeeds — local terms load.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve(csvContent),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('falls back to the local definition when the dashboard iframe never loads', async () => {
    const { container } = render(
      <DictionaryProvider>
        <DictionaryPanel
          isOpen
          onClose={vi.fn()}
          initialTermId="underwriting"
          useEmbeddedDashboard
        />
      </DictionaryProvider>
    );

    // Let the async term load settle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Embedded mode first: loading state + iframe (jsdom never fires its load).
    expect(screen.getByText(/Loading intelligence from dashboard/i)).toBeInTheDocument();
    expect(screen.getByTitle('Glossary Content')).toBeInTheDocument();

    // Past the timeout: the local definition renders instead of the loader.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EMBED_LOAD_TIMEOUT_MS + 100);
    });

    expect(screen.queryByText(/Loading intelligence from dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Glossary Content')).not.toBeInTheDocument();
    expect(screen.getByText('Underwriting')).toBeInTheDocument();
    // The simple definition renders (the technical one is hidden by the
    // default remote config's show_technical_def: false — deliberate).
    expect(container.textContent).toContain('How the bank decides your loan');
  });
});
