const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ readyState = 'loading', idle = true } = {}) {
  const handlers = {};
  const classes = new Set();
  const attributes = {};
  let draws = 0;
  let cancelled = false;
  const video = {
    paused: true,
    currentTime: 0,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
  const canvas = {
    width: 960,
    height: 540,
    getContext() { return { drawImage() { draws++; } }; },
  };
  const media = {
    querySelector(selector) { return selector === 'video' ? video : canvas; },
    addEventListener(name, handler) { handlers[name] = handler; },
    classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
    setAttribute(name, value) { attributes[name] = value; },
  };
  const year = { textContent: '' };
  const widget = {
    dataset: { src: 'https://statable.com/widget.js', id: '3384626' },
    replacements: 0,
    replaceWith(script) { this.replacement = script; this.replacements++; },
  };
  const visitorDetails = {
    open: false,
    addEventListener(name, handler) { handlers[`visitor-${name}`] = handler; },
    querySelector() { return widget.replacement ? null : widget; },
  };
  const document = {
    readyState,
    querySelector(selector) {
      return selector === '.paper-media' ? media : selector === '#year' ? year : visitorDetails;
    },
    createElement() { return { dataset: {} }; },
  };
  const window = {
    addEventListener(name, handler) { handlers[name] = handler; },
    setTimeout(handler, delay) { handlers.timer = handler; handlers.delay = delay; },
  };
  if (idle) window.requestIdleCallback = (handler, options) => {
    handlers.idle = handler;
    handlers.timeout = options.timeout;
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/script.js', 'utf8'), {
    document,
    window,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => { cancelled = true; },
    Date,
  });
  return { handlers, classes, attributes, video, year, widget, visitorDetails,
    get draws() { return draws; }, get cancelled() { return cancelled; } };
}

test('hover plays the muted preview and leaving restores the poster', async () => {
  const page = setup();
  const { handlers, classes, attributes, video, year, widget, visitorDetails } = page;
  handlers.pointerenter({ pointerType: 'mouse' });
  await Promise.resolve();
  assert.equal(video.paused, false);
  assert.equal(attributes['aria-pressed'], 'true');
  assert.equal(classes.has('is-playing'), true);
  assert.equal(page.draws, 1);

  video.currentTime = 3;
  handlers.pointerleave({ pointerType: 'mouse' });
  assert.equal(video.paused, true);
  assert.equal(video.currentTime, 0);
  assert.equal(attributes['aria-pressed'], 'false');
  assert.equal(classes.has('is-playing'), false);
  assert.equal(page.cancelled, true);
  assert.equal(year.textContent, new Date().getFullYear());

  handlers['visitor-toggle']();
  assert.equal(widget.replacement, undefined);
  visitorDetails.open = true;
  handlers['visitor-toggle']();
  assert.equal(widget.replacement.src, 'https://statable.com/widget.js');
  assert.deepEqual(Object.assign({}, widget.replacement.dataset), { id: '3384626' });
  handlers.load();
  handlers.idle();
  assert.equal(widget.replacements, 1);
});

test('map preloads only after page load and an idle callback, while staying folded', () => {
  const { handlers, widget, visitorDetails } = setup();
  assert.equal(widget.replacement, undefined);
  assert.equal(handlers.idle, undefined);
  handlers.load();
  assert.equal(widget.replacement, undefined);
  assert.equal(handlers.timeout, 3000);
  handlers.idle();
  assert.equal(widget.replacement.src, widget.dataset.src);
  assert.equal(visitorDetails.open, false);
  visitorDetails.open = true;
  handlers['visitor-toggle']();
  assert.equal(widget.replacements, 1);
});

test('already loaded pages schedule preloading with a timer when idle callbacks are unsupported', () => {
  const { handlers, widget, visitorDetails } = setup({ readyState: 'complete', idle: false });
  assert.equal(handlers.load, undefined);
  assert.equal(handlers.delay, 1000);
  assert.equal(widget.replacement, undefined);
  handlers.timer();
  assert.equal(widget.replacements, 1);
  assert.equal(visitorDetails.open, false);
});
