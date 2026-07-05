// src/playtest/remindMe.ts
//
// Client for POST /api/playtest/remind-me — sends a real email, or a text
// via a carrier's email-to-SMS gateway (phone@gateway, no SMS API needed).
// Delivery of the text path is NOT guaranteed — most US carriers throttle
// or silently drop gateway mail as an anti-spam measure. See
// server/mailer.js for the carrier list and the same caveat server-side.

import { getBackendURL } from '../utils/networkDetection';
import { getStoredCampaignSource } from './playtestStorage';

export const CARRIERS: { value: string; label: string }[] = [
  { value: 'att', label: 'AT&T' },
  { value: 'verizon', label: 'Verizon' },
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'metropcs', label: 'Metro by T-Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'googlefi', label: 'Google Fi' },
];

export interface RemindMeParams {
  method: 'email' | 'sms';
  email?: string;
  phone?: string;
  carrier?: string;
  whenLabel?: string;
  // ISO timestamp for when the reminder should actually be sent. The server
  // holds it until then (see server/reminderScheduler.js); omit to send now.
  sendAt?: string;
}

export async function sendRemindMe(params: RemindMeParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${getBackendURL()}/api/playtest/remind-me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, campaignSource: getStoredCampaignSource() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : 'Something went wrong' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
}
