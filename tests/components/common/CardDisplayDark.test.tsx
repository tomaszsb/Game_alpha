import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardDisplay } from '../../../src/components/common/CardDisplay';
import { DictionaryProvider } from '../../../src/dictionary';

// fb:e8508e3d — "individual cards are still in light mode on the modal".
describe('CardDisplay mode', () => {
  afterEach(() => cleanup());
  const card: any = { card_id: 'E1', card_name: 'On the Radar', card_type: 'E', description: 'A rep.' };

  it('renders a dark surface when mode is dark', () => {
    const { container } = render(<DictionaryProvider><CardDisplay card={card} variant="compact" mode="dark" /></DictionaryProvider>);
    expect(container.querySelector('.card-display--compact')).toHaveClass('card-display--dark');
  });

  it('stays light by default', () => {
    const { container } = render(<DictionaryProvider><CardDisplay card={card} variant="compact" /></DictionaryProvider>);
    expect(container.querySelector('.card-display--compact')).not.toHaveClass('card-display--dark');
  });
});
