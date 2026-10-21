/**
 * OtherSites.test.tsx
 *
 * "Visit our other sites" (Tom, 2026-10-21): the same two links on every surface, opening in a new tab,
 * and the printed certificate carries them too.
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { OtherSites } from '../../../src/components/common/OtherSites';
import { OTHER_SITES } from '../../../src/constants/otherSites';
import { buildCertificateHtml } from '../../../src/utils/certificate';

afterEach(cleanup);

describe('OtherSites', () => {
  it('shows every site as a link that opens in a new tab', () => {
    render(<OtherSites />);
    for (const s of OTHER_SITES) {
      const a = screen.getByRole('link', { name: s.label });
      expect(a).toHaveAttribute('href', s.url);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });
  it('the certificate carries the same links', () => {
    const html = buildCertificateHtml('A', new Date('2026-10-21T12:00:00Z'));
    for (const s of OTHER_SITES) expect(html).toContain(`<a href="${s.url}">${s.label}</a>`);
  });
});
