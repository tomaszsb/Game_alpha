// headerMenuItems - the ONE list of what the header menu can hold, in one order with one set of words, for
// the PC, the TV and the remote screen (Tom, 2026-10-08: all versions look identical). A screen passes only
// what it can do; the order and the wording never differ between screens.

import type { HeaderMenuItem } from '../components/layout/HeaderMenu';

interface Toggle { onToggle: () => void; open?: boolean }

export interface HeaderMenuOptions {
  howToPlay?: () => void;
  gameLog?: Toggle;
  standings?: Toggle;
  view?: () => void;
  glossary?: Toggle;
  connectPhone?: Toggle;
  /** This device's own light / dark. */
  theme?: { dark: boolean; toggle: () => void };
  /** Fast / Normal for this device. */
  speed: { fast: boolean; toggle: () => void };
  /** The shared TV screen's light / dark (admin or teacher only). */
  tvTheme?: { dark: boolean; toggle: () => void };
}

export function buildHeaderMenuItems(o: HeaderMenuOptions): HeaderMenuItem[] {
  const items: HeaderMenuItem[] = [];
  if (o.howToPlay) items.push({ id: 'how-to-play', icon: '📋', label: 'How to play', onSelect: o.howToPlay });
  if (o.gameLog) items.push({ id: 'game-log', icon: '📜', label: 'Game log', onSelect: o.gameLog.onToggle, active: o.gameLog.open });
  if (o.standings) items.push({ id: 'standings', icon: '📊', label: 'Standings', onSelect: o.standings.onToggle, active: o.standings.open });
  if (o.view) items.push({ id: 'view', icon: '👁️', label: 'View', onSelect: o.view });
  if (o.glossary) items.push({ id: 'glossary', icon: '📖', label: 'Glossary', onSelect: o.glossary.onToggle, active: o.glossary.open });
  if (o.connectPhone) items.push({ id: 'connect-phone', icon: '📱', label: 'Connect phone', onSelect: o.connectPhone.onToggle, active: o.connectPhone.open });
  if (o.theme) items.push({ id: 'theme', icon: o.theme.dark ? '☀️' : '🌙', label: o.theme.dark ? 'Light mode' : 'Dark mode', onSelect: o.theme.toggle, title: 'Light / dark mode on this screen' });
  items.push({
    id: 'speed', icon: '⚡', label: `Speed: ${o.speed.fast ? 'Fast' : 'Normal'}`, onSelect: o.speed.toggle, stayOpen: true,
    testId: 'game-speed-toggle', title: 'Fast shortens the pauses, glides and pop-up notes on this screen only',
  });
  if (o.tvTheme) items.push({ id: 'tv-theme', icon: '📺', label: o.tvTheme.dark ? 'TV theme: dark' : 'TV theme: light', onSelect: o.tvTheme.toggle, title: 'Switch the shared TV screen between light and dark' });
  return items;
}
