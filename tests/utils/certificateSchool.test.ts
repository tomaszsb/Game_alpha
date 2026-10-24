import { describe, it, expect } from 'vitest';
import { buildCertificateHtml } from '../../src/utils/certificate';

const d = new Date(2026, 9, 24);
const LOGO = 'https://game.test/api/instances/room-1/logo?v=3';

describe('certificate with a school', () => {
  it('is exactly as before when there is no school', () => {
    expect(buildCertificateHtml('Maya', d, [], '', 'https://game.test', null))
      .toBe(buildCertificateHtml('Maya', d, [], '', 'https://game.test'));
    expect(buildCertificateHtml('Maya', d)).not.toContain('Played at');
  });

  it('says "Played at <school>" and never "approved by" or "awarded by"', () => {
    const html = buildCertificateHtml('Maya', d, [], '', 'https://game.test', { name: 'Farmingdale State', logoUrl: null });
    expect(html).toContain('Played at <strong>Farmingdale State</strong>');
    expect(html).not.toMatch(/approved by|awarded by|endorsed by/i);
  });

  it("puts the school logo on top by its full address, and Unravel's small one at the foot", () => {
    const html = buildCertificateHtml('Maya', d, [], '', 'https://game.test', { name: 'Farmingdale State', logoUrl: LOGO });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html.indexOf(LOGO)).toBeLessThan(html.indexOf('Certificate of Completion'));
    expect(html.indexOf('class="logo small-logo"')).toBeGreaterThan(html.indexOf('Certificate of Completion'));
    expect(html).toContain('https://game.test/images/logo.png');
  });

  it("with a name but no logo, keeps Unravel's logo on top", () => {
    const html = buildCertificateHtml('Maya', d, [], '', 'https://game.test', { name: 'Farmingdale State', logoUrl: null });
    expect(html.indexOf('/images/logo.png')).toBeLessThan(html.indexOf('Certificate of Completion'));
    expect(html).not.toContain('class="logo small-logo"');
  });

  it('refuses a logo address that is not a full http(s) address (a relative one would not load on this page)', () => {
    for (const bad of ['/api/instances/room-1/logo', 'javascript:alert(1)', 'data:image/png;base64,AAAA']) {
      const html = buildCertificateHtml('Maya', d, [], '', '', { name: null, logoUrl: bad });
      expect(html).not.toContain(`src="${bad}"`);
    }
  });

  it('escapes a hostile school name', () => {
    const html = buildCertificateHtml('Maya', d, [], '', '', { name: '<script>alert(1)</script>', logoUrl: null });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
