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
  notListed: 'My TV isn’t listed',
  makersNote: 'Listed only so you can find your steps. We are not recommending or selling any of them.',
  // Alphabetical. Nothing highlighted, no logos. A maker is listed only if its OWN page says what its TVs do about
  // browsers (checked 2026-10-23); where the official page says less, the words say only what it does support.
  makers: [
    // Amazon press release (press.aboutamazon.com/2017/12/amazon-brings-web-browsing-to-fire-tv): Firefox and Silk
    // browsers can be downloaded on every Fire TV device. It is from 2017, so the words stay general.
    { name: 'Amazon Fire TV', steps: 'Install a free browser from the Fire TV app store, open it, and type the game address.' },
    // Apple's AirPlay page (support.apple.com/en-gb/guide/tv/atvbf2be9ef7/tvos) covers mirroring a phone, tablet or
    // Mac to Apple TV. Apple has no official page found that says "no browser"; that part is only forum talk, so unsaid.
    { name: 'Apple TV', steps: 'Apple’s help shows how to AirPlay a phone, tablet or Mac screen to Apple TV. Open the game on that device in an up-to-date browser and pick TV, or use a laptop on HDMI.' },
    // Google's help pages (support.google.com/chromecast/answer/3228332) only describe CASTING a Chrome tab from a
    // computer. No official page found for a browser app on the TV itself, so that is only "look in the app store".
    { name: 'Google TV', steps: 'Google’s help shows how to cast a Chrome tab from a laptop to the TV. You can also look in the TV’s app store for a free browser.' },
    // LG support page (lg.com/us/support/help-library/lg-tv-how-to-use-the-web-browser--20153257222107): press Home,
    // open Web browser, type an address. The 2021-or-older line is our own finding (CHANGELOG 3.8.16).
    { name: 'LG', steps: 'Press Home, open Web Browser, and type the game address. LG TVs from 2021 or older cannot run this game: use a laptop on HDMI.' },
    // Roku support (support.roku.com/article/can-i-browse-the-internet): says plainly Roku has no web browser.
    { name: 'Roku', steps: 'Roku says its players and TVs have no web browser. Use a laptop on HDMI, or cast or mirror a laptop or phone screen to it.' },
    // Samsung support (samsung.com/hk_en/support/tv-audio-video/how-to-open-website-in-smart-tv/): open the web
    // browser app and type an address. The 2021-or-older line is our own finding (CHANGELOG 3.8.16, Samsung's chart).
    { name: 'Samsung', steps: 'Open the Internet (or Web Browser) app and type the game address. Samsung TVs from 2021 or older cannot run this game: use a laptop on HDMI.' },
  ],
} as const;
