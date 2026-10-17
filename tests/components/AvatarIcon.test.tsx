import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AvatarIcon } from '../../src/components/icons/AvatarIcons';

describe('AvatarIcon size', () => {
  it('a CSS length goes in the style, not the width attribute (the attribute reads "1em" as 1px)', () => {
    const { container } = render(<AvatarIcon avatar="👤" size="1em" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('width')).toBeNull();
    expect(img.style.width).toBe('1em');
    expect(img.style.height).toBe('1em');
  });

  it('a number still sets both the attribute and the style', () => {
    const { container } = render(<AvatarIcon avatar="👤" size={32} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('32');
    expect(img.style.width).toBe('32px');
  });
});
