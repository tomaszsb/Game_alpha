// progressBarFold - the top progress bar starts FOLDED to its one-line strip on every screen (Tom,
// 2026-10-12: "phase indicators are very big and take a lot of space on the PC", answer 1a). The TV
// already starts folded; this makes the PC and the remote match. Opening it is remembered on this
// device, like Speed and the board style.

const KEY = 'uc-progress-bar-open';

export function isProgressBarRememberedOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'open';
  } catch {
    return false;
  }
}

export function rememberProgressBarOpen(open: boolean): void {
  try {
    if (open) localStorage.setItem(KEY, 'open');
    else localStorage.removeItem(KEY);
  } catch { /* private window: lasts until reload */ }
}
