import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HelpCard } from '../../../src/components/help/HelpCard';
import { panelPalettes } from '../../../src/components/player/panelTheme';
import { DictionaryProvider } from '../../../src/dictionary';

/**
 * The one card a "?" opens (v3.2.71). An action explains itself in a main line
 * plus a smaller grey one; a space explains "What to do:" and "Why:". Both must
 * wear the same box, in the same order, or "one ? everywhere" is only a slogan.
 */
describe('HelpCard', () => {
  afterEach(() => cleanup());

  const card = (sections: React.ComponentProps<typeof HelpCard>['sections'], extra = {}) =>
    render(<HelpCard id="help-card-x" kind="action" palette={panelPalettes.light} sections={sections} {...extra} />);

  it('renders nothing when every section is empty', () => {
    // An empty card would be a "?" that opens onto nothing.
    const { container } = card([{ text: '' }, { text: '   ', muted: true }]);
    expect(container).toBeEmptyDOMElement();
  });

  it('skips an empty section but keeps the others', () => {
    // Fee has no grey line by design (v3.2.69), so its context is empty.
    card([{ text: 'This shows what you pay.' }, { text: '', muted: true }]);
    expect(screen.getByText('This shows what you pay.')).toBeInTheDocument();
    expect(screen.getByTestId('help-card').children).toHaveLength(1);
  });

  it('carries the id its button points at, and hooks that are not copy', () => {
    card([{ text: 'Hello.' }], { kind: 'step' });
    const el = screen.getByTestId('help-card');
    expect(el).toHaveAttribute('id', 'help-card-x');
    expect(el).toHaveAttribute('data-help-kind', 'step');
  });

  it('shows sections in order with a bold lead-in', () => {
    card([
      { label: 'What to do:', text: 'Lock the scope as offered.' },
      { label: 'Why:', text: 'Scope is locked. Funding next.' },
    ]);
    const el = screen.getByTestId('help-card');
    expect(el.textContent).toBe('What to do: Lock the scope as offered.Why: Scope is locked. Funding next.');
    const labels = [...el.querySelectorAll('strong')].map((s) => s.textContent);
    expect(labels).toEqual(['What to do: ', 'Why: ']);
  });

  it('sets the grey line smaller and apart from the main line', () => {
    card([{ text: 'Main line.' }, { text: 'Grey line.', muted: true }]);
    const grey = screen.getByText('Grey line.');
    expect(grey).toHaveStyle({ fontSize: '11.5px', marginTop: '6px' });
    expect(screen.getByText('Main line.')).not.toHaveStyle({ marginTop: '6px' });
  });

  it('keeps a blank line between joined explanations (pre-line)', () => {
    // A merged dice button joins two authored explanations with "\n\n" (v3.2.69).
    card([{ text: 'First part.\n\nSecond part.' }]);
    expect(screen.getByTestId('help-card')).toHaveStyle({ whiteSpace: 'pre-line' });
  });

  it('renders plain text when no glossary handler is given (the editor preview has no dictionary)', () => {
    // No DictionaryProvider here — TextWithTerms would need one, so it must not run.
    card([{ text: 'Plain words about scope.' }]);
    expect(screen.getByText('Plain words about scope.')).toBeInTheDocument();
  });

  it('routes words through the glossary when a handler is given', () => {
    render(
      <DictionaryProvider>
        <HelpCard
          id="help-card-x"
          kind="action"
          palette={panelPalettes.light}
          onTermClick={vi.fn()}
          sections={[{ text: 'Adding work makes your project bigger.' }]}
        />
      </DictionaryProvider>,
    );
    expect(screen.getByTestId('help-card')).toHaveTextContent('Adding work makes your project bigger.');
  });
});
