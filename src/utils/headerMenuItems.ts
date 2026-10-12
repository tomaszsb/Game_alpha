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
  /** The game code, with a share / copy link for a friend (it used to sit in the top bar). */
  invite?: { code: string; copied: boolean; onInvite: () => void };
  /** Classic board / town for this device; only when the board has a town (TOWN.csv). */
  boardStyle?: { town: boolean; toggle: () => void };
  /** The town's result chimes, on / off for this device; only when the board has a town (TOWN.csv). */
  sound?: { on: boolean; toggle: () => void };
  /** The shared TV screen's light / dark (admin or teacher only). */
  tvTheme?: { dark: boolean; toggle: () => void };
}

export function buildHeaderMenuItems(o: HeaderMenuOptions): HeaderMenuItem[] {
  const items: HeaderMenuItem[] = [];
  if (o.invite) {
    items.push({
      id: 'invite', icon: '🔗', label: o.invite.copied ? 'Link copied' : `Invite a friend · ${o.invite.code}`,
      onSelect: o.invite.onInvite, stayOpen: true, testId: 'invite-friend',
      title: 'Share a link so someone can join this game (on a computer it copies the link)',
    });
  }
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
  if (o.boardStyle) {
    items.push({
      id: 'board-style', icon: o.boardStyle.town ? '🏘️' : '🗺️', label: `Board: ${o.boardStyle.town ? 'Town' : 'Classic'}`,
      onSelect: o.boardStyle.toggle, stayOpen: true, testId: 'board-style-toggle',
      title: 'Draw the board as a town or as the classic squares, on this screen only',
    });
  }
  if (o.sound) {
    items.push({
      id: 'sound', icon: o.sound.on ? '🔔' : '🔕', label: `Sound: ${o.sound.on ? 'On' : 'Off'}`,
      onSelect: o.sound.toggle, stayOpen: true, testId: 'sound-toggle',
      title: 'A short chime when a result floats up on the town, on this screen only',
    });
  }
  if (o.tvTheme) items.push({ id: 'tv-theme', icon: '📺', label: o.tvTheme.dark ? 'TV theme: dark' : 'TV theme: light', onSelect: o.tvTheme.toggle, title: 'Switch the shared TV screen between light and dark' });
  return items;
}
