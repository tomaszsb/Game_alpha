// src/utils/adminAuth.ts
// Simple admin authentication utility
// Uses sessionStorage so auth resets when tab is closed

import { getBackendURL } from './networkDetection';

const SESSION_KEY = 'admin_authenticated';

/**
 * Check if admin is already authenticated this session
 */
export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

/**
 * Verify admin password against server
 * @returns true if password is correct
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const backendURL = getBackendURL();
    const response = await fetch(`${backendURL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Clear admin authentication
 */
export function clearAdminAuth(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
