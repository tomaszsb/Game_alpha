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
export type StepIcon = 'tv' | 'keyboard' | 'phone' | 'plug' | 'laptop' | 'share' | 'globe';
export interface Step { icon: StepIcon; text: string; code?: string; note?: string }

export const BIG_SCREEN = {
  headline: 'Playing with a group? Put the board on a big screen.',
  body: 'A phone alone is not enough: the board needs a TV or laptop.',
  openButton: 'Put it on a TV',
  playAloneButton: 'Play alone on this phone',
  // Same hint the old yellow banner carried for a real TV that was mistaken for a phone.
  desktopSiteHint: 'On a real TV but seeing this? Turn off “Request desktop site” in the browser menu.',
  title: 'Step 1: put the game on a big screen',
  question: 'What can your TV do?',
  pairTitle: 'Phone and TV, together',
  // Picture-first (v3.8.49, Tom: "a picture says a thousand words"): each choice and step is an icon plus a few words.
  options: {
    browser: { label: 'My TV has a browser', hint: 'Internet, Web Browser', icon: 'globe' },
    stick: { label: 'I plug in a stick or box', hint: '', icon: 'plug' },
    none: { label: 'No browser: use a laptop', hint: 'HDMI cable or share screen', icon: 'laptop' },
  } as Record<TvKind, { label: string; hint: string; icon: StepIcon }>,
  back: 'Back',
  // Steps for a TV that has (or can get) a browser. Step 1 changes by kind.
  stepsBrowser: [
    { icon: 'tv', text: 'Open the TV browser', note: 'Internet, Web Browser or Browser' },
    { icon: 'keyboard', text: 'Type with the remote', code: GAME_ADDRESS },
    { icon: 'phone', text: 'Type the TV’s code here', code: 'G-A7F9-K3PX', note: 'Pick your name. Whoever runs the TV adds one player per phone first.' },
  ] as Step[],
  stepsStick: [
    { icon: 'plug', text: 'Open the stick’s browser', note: 'None? Install a free one from its app store.' },
    { icon: 'keyboard', text: 'Type with the remote', code: GAME_ADDRESS },
    { icon: 'phone', text: 'Type the TV’s code here', code: 'G-A7F9-K3PX', note: 'Pick your name. Whoever runs the TV adds one player per phone first.' },
  ] as Step[],
  ready: 'I see the code on the TV',
  readyElsewhere: 'Then, on this phone, open the game and tap Join to type the code.',
  // Stuck on "Loading..." for 10+ seconds, or no browser at all.
  stuckTitle: 'Stuck on “Loading…”? Too old?',
  stuckInstall: 'Install a free browser from your TV’s app store. A browser seen working: TV Bro. It is free and we get nothing from it. We cannot promise every TV works.',
  stuckOld: 'Samsung and LG TVs from 2021 or older cannot run this game.',
  laptopTitle: 'Use a laptop instead',
  laptop: [
    { icon: 'laptop', text: 'Laptop to TV with an HDMI cable', note: 'Switch the TV to that input.' },
    { icon: 'tv', text: 'On the laptop, open the game and pick TV', note: 'Use an up-to-date browser.' },
    { icon: 'share', text: 'Or share a laptop or phone screen', note: 'AirPlay, Cast or Miracast.' },
  ] as Step[],
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

// The mode buttons on a PHONE-sized screen (v3.8.62, Tom 2026-10-24, option B): "PC" and "TV" mean little on a
// phone, so each button says what it does, with the same words the Step 1 guide already uses. Wide screens keep
// their "PC" / "TV" labels and Remote is the same everywhere (ModeToggle.tsx).
export const MODE_BUTTONS_PHONE = { pc: BIG_SCREEN.playAloneButton, tv: BIG_SCREEN.openButton };
