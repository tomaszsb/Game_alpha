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

  it('shows both course boxes, only the chosen one ticked', () => {
    const d = new Date(2026, 9, 17);
    const none = buildCertificateHtml('Maya', d);
    expect(none).toContain('Course 350');
    expect(none).toContain('Course 409');
    expect(none).not.toContain('&#10003;');
    const c409 = buildCertificateHtml('Maya', d, [], '409');
    expect(c409.match(/&#10003;/g)).toHaveLength(1);
    expect(c409).toMatch(/data-course="409"><i class="box">&#10003;/);
    expect(c409).toMatch(/data-course="350"><i class="box"><\/i>/);
  });

  it('has a joke', () => {
    expect(STRUCTURAL_JOKE.length).toBeGreaterThan(20);
  });
});
