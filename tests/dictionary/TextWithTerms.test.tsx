/**
 * TextWithTerms.test.tsx
 *
 * Tests that TextWithTerms highlights glossary terms in rendered text,
 * including after async term loading completes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextWithTerms } from '../../src/dictionary/components/TextWithTerms';
import { DictionaryProvider } from '../../src/dictionary/context/DictionaryContext';
import { clearCache } from '../../src/dictionary/data/terms';

// CSV content that loadTerms can parse via the CSV fallback path
const csvContent = [
  'id,term,definition_technical,definition_simple,instructions,category,source,needs_review,aliases,related_terms,image_url,video_url,source_url,instagram_link',
  'hvac,HVAC,Heating Ventilation and Air Conditioning,The systems that heat and cool a building,,Construction,game,false,,,,,,',
  'dob,DOB,Department of Buildings,The city agency that oversees construction,,Agencies,game,false,Department of Buildings,,,,,'
].join('\n');

function renderWithDictionary(text: string, onTermClick?: (term: any) => void) {
  return render(
    <DictionaryProvider>
      <TextWithTerms text={text} onTermClick={onTermClick} />
    </DictionaryProvider>
  );
}

/** Find a highlighted term link by its title attribute */
function getTermLink(termName: string) {
  return screen.getByTitle(`Click to learn about: ${termName}`);
}

function queryTermLink(termName: string) {
  return screen.queryByTitle(`Click to learn about: ${termName}`);
}

describe('TextWithTerms', () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();

    // Mock fetch: API call is skipped (cross-origin in jsdom), CSV fallback returns our terms
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(csvContent),
    }));
  });

  it('should highlight glossary terms after async loading', async () => {
    renderWithDictionary('You need to install HVAC before calling the DOB.');

    await waitFor(() => {
      expect(getTermLink('HVAC')).toBeDefined();
    });

    expect(getTermLink('HVAC').textContent).toBe('HVAC');
    expect(getTermLink('DOB').textContent).toBe('DOB');
  });

  it('should render plain text when no glossary terms match', async () => {
    renderWithDictionary('This sentence has no special words.');

    // Wait for loading to finish (terms load but none match)
    await waitFor(() => {
      expect(screen.getByText('This sentence has no special words.')).toBeDefined();
    });

    // No term links should exist
    expect(queryTermLink('HVAC')).toBeNull();
    expect(queryTermLink('DOB')).toBeNull();
  });

  it('should highlight alias matches', async () => {
    renderWithDictionary('Contact the Department of Buildings for permits.');

    await waitFor(() => {
      expect(getTermLink('DOB')).toBeDefined();
    });

    expect(getTermLink('DOB').textContent).toBe('Department of Buildings');
  });

  it('should call onTermClick when a highlighted term is clicked', async () => {
    const onClick = vi.fn();
    renderWithDictionary('Check with the DOB first.', onClick);

    await waitFor(() => {
      expect(getTermLink('DOB')).toBeDefined();
    });

    await userEvent.click(getTermLink('DOB'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dob', term: 'DOB' })
    );
  });

  it('should match terms case-insensitively', async () => {
    renderWithDictionary('The hvac system needs inspection.');

    await waitFor(() => {
      expect(getTermLink('HVAC')).toBeDefined();
    });

    expect(getTermLink('HVAC').textContent).toBe('hvac');
  });
});
