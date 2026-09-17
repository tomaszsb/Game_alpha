import { describe, it, expect, beforeEach } from 'vitest';
import { liftModalsForCapture } from '../../src/utils/screenshotClone';

// fb:f33ae50b — a modal opened inside the overflow:hidden player panel was
// clipped out of the html2canvas capture. The clone's modal layer must end up
// directly under <body>.
describe('liftModalsForCapture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('moves a fixed modal overlay out of an overflow:hidden panel to <body>', () => {
    document.body.innerHTML = `
      <div id="panel" style="overflow: hidden; position: relative">
        <div id="overlay" style="position: fixed; inset: 0">
          <div role="dialog" aria-modal="true" id="dialog">Your Expeditors</div>
        </div>
      </div>`;

    expect(liftModalsForCapture(document)).toBe(1);
    const overlay = document.getElementById('overlay')!;
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.contains(document.getElementById('dialog'))).toBe(true);
    expect(document.getElementById('panel')!.contains(overlay)).toBe(false);
  });

  it('lifts the OUTERMOST fixed layer, not a fixed element inside the dialog', () => {
    document.body.innerHTML = `
      <div style="overflow: hidden">
        <div id="overlay" style="position: fixed">
          <div role="dialog" aria-modal="true">
            <div id="inner" style="position: fixed">tooltip</div>
          </div>
        </div>
      </div>`;
    // The inner fixed element is not a dialog ancestor, so only the overlay qualifies.
    liftModalsForCapture(document);
    expect(document.getElementById('overlay')!.parentElement).toBe(document.body);
  });

  it('leaves a modal that is already at the top level alone', () => {
    document.body.innerHTML = `
      <div id="app">board</div>
      <div id="overlay" style="position: fixed"><div role="dialog" aria-modal="true">Dice result</div></div>`;
    const before = document.body.innerHTML;
    expect(liftModalsForCapture(document)).toBe(0);
    expect(document.body.innerHTML).toBe(before);
  });

  it('does nothing when no modal is open', () => {
    document.body.innerHTML = `<div style="overflow:hidden"><div style="position:fixed">hint</div></div>`;
    expect(liftModalsForCapture(document)).toBe(0);
  });
});
