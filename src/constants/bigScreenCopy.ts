// src/constants/bigScreenCopy.ts
//
// The words for "Step 1: put the game on a big screen" - one place, read by the setup screen
// (BigScreenGuide on a phone) and by the /challenge and /class landing pages, so a student is
// told the same thing wherever they first open the game.
//
// Rules (Tom, 2026-10-23): ask what the TV CAN DO, not its brand. Brands appear only behind a
// small link, alphabetical, none favoured. An app is named only if it has been seen working
// (today: TV Bro). Phone and laptop browsers are never named: "an up-to-date browser".

export const GAME_ADDRESS = 'game.unravelcodes.com';

export type TvKind = 'browser' | 'stick' | 'none';

export const BIG_SCREEN = {
  headline: 'Playing with a group? Put the board on a big screen.',
  body: 'A phone alone is not enough: the board needs a TV or laptop.',
  openButton: 'Put it on a TV',
  playAloneButton: 'Play alone on this phone',
  // Same hint the old yellow banner carried for a real TV that was mistaken for a phone.
  desktopSiteHint: 'On a real TV but seeing this? Turn off “Request desktop site” in the browser menu.',
  title: 'Step 1: put the game on a big screen',
  question: 'What can your TV do?',
  options: {
    browser: { label: 'It has a web browser app', hint: 'Look for an app called Internet, Web Browser or Browser.' },
    stick: { label: 'I plug in a stick or box', hint: 'For example a streaming stick or a set-top box.' },
    none: { label: 'It has no browser', hint: 'Or you are not sure.' },
  } as Record<TvKind, { label: string; hint: string }>,
  back: 'Back',
  // Steps for a TV that has (or can get) a browser. Step 1 changes by kind.
  stepsBrowser: [
    'On the TV, open the browser app (Internet, Web Browser or Browser).',
    `Type this address with the TV remote: ${GAME_ADDRESS}`,
    'The TV shows a game code (like G-A7F9-K3PX). Type it on this phone and pick your name. Whoever runs the TV adds one player per phone first.',
  ],
  stepsStick: [
    'On the stick or box, open its web browser. No browser? Install a free one from its app store.',
    `Type this address with the remote: ${GAME_ADDRESS}`,
    'The TV shows a game code (like G-A7F9-K3PX). Type it on this phone and pick your name. Whoever runs the TV adds one player per phone first.',
  ],
  ready: 'I see the code on the TV',
  readyElsewhere: 'Then, on this phone, open the game and tap Join to type the code.',
  // Stuck on "Loading..." for 10+ seconds, or no browser at all.
  stuckTitle: 'TV stays on “Loading…”, or has no browser?',
  stuckInstall: 'Install a free browser from your TV’s app store. A browser seen working: TV Bro. It is free and we get nothing from it. We cannot promise every TV works.',
  stuckOld: 'Samsung and LG TVs from 2021 or older cannot run this game.',
  laptopTitle: 'Use a laptop instead',
  laptop: [
    'Plug the laptop into the TV with an HDMI cable and switch the TV to that input.',
    'On the laptop, open the game in an up-to-date browser and pick TV.',
    'Or show a laptop or phone screen on the TV with the TV’s screen sharing (AirPlay, Cast or Miracast).',
  ],
  makersLink: 'Show steps for my TV maker',
  makersHide: 'Hide TV makers',
  makersNote: 'Listed only so you can find your steps. We are not recommending or selling any of them.',
  // Alphabetical. Nothing highlighted, no logos.
  makers: [
    { name: 'Amazon Fire TV', steps: 'Install a free browser from the Fire TV app store, open it, and type the game address.' },
    { name: 'Apple TV', steps: 'Apple TV has no web browser. Use a laptop on HDMI, or AirPlay a laptop or phone screen to it.' },
    { name: 'Google TV', steps: 'Look for a browser app. If there is none, install a free browser from the TV’s app store, then type the game address.' },
    { name: 'LG', steps: 'Press Home, open Web Browser, and type the game address. LG TVs from 2021 or older cannot run this game: use a laptop on HDMI.' },
    { name: 'Roku', steps: 'Roku has no web browser. Use a laptop on HDMI, or cast or mirror a laptop or phone screen to it.' },
    { name: 'Samsung', steps: 'Open the Internet (or Web Browser) app and type the game address. Samsung TVs from 2021 or older cannot run this game: use a laptop on HDMI.' },
  ],
} as const;
