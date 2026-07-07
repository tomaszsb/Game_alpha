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
