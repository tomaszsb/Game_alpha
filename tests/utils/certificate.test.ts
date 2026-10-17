import { describe, it, expect } from 'vitest';
import { buildCertificateHtml, STRUCTURAL_JOKE } from '../../src/utils/certificate';

describe('certificate', () => {
  it('prints the player name and the date', () => {
    const html = buildCertificateHtml('Maya Chen', new Date(2026, 9, 17));
    expect(html).toContain('Maya Chen');
    expect(html).toContain('October 17, 2026');
    expect(html).toContain('Unravel Codes');
  });

  it('escapes a hostile name', () => {
    const html = buildCertificateHtml('<script>alert(1)</script>', new Date(2026, 9, 17));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back when the name is blank and has no inline handler (CSP)', () => {
    const html = buildCertificateHtml('   ', new Date(2026, 9, 17));
    expect(html).toContain('A Player');
    expect(html).not.toContain('onclick');
  });

  it('has a joke', () => {
    expect(STRUCTURAL_JOKE.length).toBeGreaterThan(20);
  });
});
