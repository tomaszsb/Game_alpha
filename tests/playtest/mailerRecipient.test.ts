import { describe, it, expect } from 'vitest';
import { resolveRecipient, CARRIER_GATEWAYS } from '../../server/mailer.js';

// resolveRecipient is the up-front validation the /remind-me endpoint runs so
// a bad address/carrier is rejected while the visitor is still on the form,
// rather than being silently dropped when the scheduler fires it later.
describe('mailer.resolveRecipient', () => {
  it('returns the email address for a valid email reminder', () => {
    expect(resolveRecipient({ method: 'email', email: 'a@b.com' })).toBe('a@b.com');
  });

  it('throws BAD_REQUEST when the email is missing', () => {
    expect.assertions(2);
    try {
      resolveRecipient({ method: 'email' });
    } catch (err: any) {
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.message).toMatch(/email/i);
    }
  });

  it('builds phone@gateway for a valid sms reminder, stripping formatting', () => {
    const to = resolveRecipient({ method: 'sms', phone: '(555) 123-4567', carrier: 'verizon' });
    expect(to).toBe(`5551234567@${CARRIER_GATEWAYS.verizon}`);
  });

  it('throws BAD_REQUEST for an unknown carrier', () => {
    expect(() => resolveRecipient({ method: 'sms', phone: '5551234567', carrier: 'nope' }))
      .toThrowError(/carrier/i);
  });

  it('throws BAD_REQUEST when the phone number has no digits', () => {
    expect(() => resolveRecipient({ method: 'sms', phone: 'abc', carrier: 'att' }))
      .toThrow();
  });

  it('throws BAD_REQUEST for an unsupported method', () => {
    try {
      resolveRecipient({ method: 'carrier-pigeon' } as any);
    } catch (err: any) {
      expect(err.code).toBe('BAD_REQUEST');
    }
  });
});

// v3.8.64: exactly ONE plain address reaches nodemailer's address parser.
describe('mailer.resolveRecipient: the typed email is one plain address', () => {
  const rejected = (email: unknown) => {
    try { resolveRecipient({ method: 'email', email } as any); } catch (err: any) { return err.code; }
    return 'accepted';
  };

  it('accepts a good address and trims stray spaces around it', () => {
    expect(resolveRecipient({ method: 'email', email: ' Name.Last+tag@school.example.edu ' })).toBe('Name.Last+tag@school.example.edu');
  });

  it('rejects two addresses (comma, semicolon, space)', () => {
    expect(rejected('a@b.com,c@d.com')).toBe('BAD_REQUEST');
    expect(rejected('a@b.com;c@d.com')).toBe('BAD_REQUEST');
    expect(rejected('a@b.com c@d.com')).toBe('BAD_REQUEST');
  });

  it('rejects header-injection and display-name style values', () => {
    expect(rejected('a@b.com\r\nBcc: victim@example.com')).toBe('BAD_REQUEST');
    expect(rejected('a@b.com\nSubject: hi')).toBe('BAD_REQUEST');
    expect(rejected('"a@b.com" <c@d.com>')).toBe('BAD_REQUEST');
    expect(rejected('<a@b.com>')).toBe('BAD_REQUEST');
    expect(rejected('a(comment)@b.com')).toBe('BAD_REQUEST');
    expect(rejected('a@b.com\u0000')).toBe('BAD_REQUEST');
  });

  it('rejects empty, not-an-address and over-long values', () => {
    expect(rejected('')).toBe('BAD_REQUEST');
    expect(rejected('   ')).toBe('BAD_REQUEST');
    expect(rejected('no-at-sign')).toBe('BAD_REQUEST');
    expect(rejected('a@b')).toBe('BAD_REQUEST');
    expect(rejected(['a@b.com'])).toBe('BAD_REQUEST');
    expect(rejected('x'.repeat(65) + '@b.com')).toBe('BAD_REQUEST');
    expect(rejected('a@' + 'b'.repeat(260) + '.com')).toBe('BAD_REQUEST');
  });

  it('gives a plain message the form can show', () => {
    try { resolveRecipient({ method: 'email', email: 'a@b.com, c@d.com' }); } catch (err: any) {
      expect(err.message).toBe('Please type one email address, like name@example.com');
    }
  });
});
