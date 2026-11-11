const test = require('node:test');
const assert = require('node:assert/strict');
const { MockDocument, MockElement, MockVideoElement } = require('./dom-mock');
const { createController } = require('../src/content/content');
const { HOST_ID } = require('../src/content/player-ui');
const { MESSAGE_TYPES } = require('../src/shared/constants');

function createMockChrome(initialStorage = {}) {
  const storageData = { ...initialStorage };
  const messageListeners = new Set();
  const storageListeners = new Set();

  return {
    storage: {
      sync: {
        get: (defaults, cb) => cb({ ...defaults, ...storageData }),
        set: (items, cb) => {
          Object.assign(storageData, items);
          if (cb) cb();
        }
      },
      onChanged: {
        addListener: (fn) => storageListeners.add(fn),
        removeListener: (fn) => storageListeners.delete(fn)
      }
    },
    runtime: {
      sendMessage: () => Promise.resolve(),
      onMessage: {
        addListener: (fn) => messageListeners.add(fn),
        removeListener: (fn) => messageListeners.delete(fn)
      }
    },
    _storageListeners: storageListeners
  };
}

test('Controller mounts Shadow DOM UI, handles fullscreen reparenting, and responds to shortcuts', async () => {
  const doc = new MockDocument();
  const playerWrapper = new MockElement('DIV', doc);
  const video = new MockVideoElement(doc, { rect: { top: 40, left: 20, width: 1280, height: 720 } });
  playerWrapper.appendChild(video);
  doc.body.appendChild(playerWrapper);

  const chromeApi = createMockChrome();
  const controller = createController({ document: doc, window: {}, chromeApi });
  await controller.init();

  const host = doc.getElementById(HOST_ID);
  assert.ok(host, 'Shadow DOM host should be mounted');
  assert.equal(host.parentNode, doc.body);
  assert.equal(host.style.top, '40px');
  assert.equal(host.style.left, '20px');
  assert.equal(host.style.width, '1280px');
  assert.equal(host.style.height, '720px');

  // Enter fullscreen on Hotstar's player wrapper
  doc.fullscreenElement = playerWrapper;
  doc.dispatchEvent({ type: 'fullscreenchange', target: doc });
  assert.equal(host.parentNode, playerWrapper, 'Host must reparent inside fullscreenElement');
  assert.equal(host.style.width, '100%');
  assert.equal(host.style.height, '100%');

  // Exit fullscreen
  doc.fullscreenElement = null;
  doc.dispatchEvent({ type: 'fullscreenchange', target: doc });
  assert.equal(host.parentNode, doc.body);

  // Keyboard shortcuts: ] increases, [ decreases, \ toggles 1.0x <-> last custom speed
  let prevented = false;
  let stopped = false;
  const makeKey = (key, extra = {}) => ({
    key,
    target: { tagName: 'BODY' },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
    ...extra
  });

  doc.dispatchEvent({ type: 'keydown', ...makeKey(']') });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(video.playbackRate, 1.25);

  doc.dispatchEvent({ type: 'keydown', ...makeKey('>', { shiftKey: true }) });
  assert.equal(video.playbackRate, 1.5);

  doc.dispatchEvent({ type: 'keydown', ...makeKey('\\') });
  assert.equal(video.playbackRate, 1.0);

  // Pressing reset shortcut again restores previous custom speed (1.5x)
  doc.dispatchEvent({ type: 'keydown', ...makeKey('\\') });
  assert.equal(video.playbackRate, 1.5);

  doc.dispatchEvent({ type: 'keydown', ...makeKey('[') });
  assert.equal(video.playbackRate, 1.25);

  controller.destroy();
});

test('Controller handles popup messages and preserves active speed on unrelated setting updates', async () => {
  const doc = new MockDocument();
  const video = new MockVideoElement(doc);
  doc.body.appendChild(video);

  const chromeApi = createMockChrome();
  const controller = createController({ document: doc, window: {}, chromeApi });
  await controller.init();

  let lastResponse = null;
  const reply = (res) => { lastResponse = res; };

  controller.handleRuntimeMessage({ type: MESSAGE_TYPES.GET_STATUS }, {}, reply);
  assert.equal(lastResponse.hasVideo, true);
  assert.equal(lastResponse.speed, 1.0);

  controller.handleRuntimeMessage({ type: MESSAGE_TYPES.SET_SPEED, speed: 1.75 }, {}, reply);
  assert.equal(lastResponse.speed, 1.75);
  assert.equal(video.playbackRate, 1.75);

  // Updating rememberSpeed or overlayCorner must NOT reset current speed
  controller.handleRuntimeMessage(
    { type: MESSAGE_TYPES.UPDATE_SETTINGS, settings: { rememberSpeed: false, overlayCorner: 'bottom-left' } },
    {},
    reply
  );
  assert.equal(lastResponse.speed, 1.75);
  assert.equal(lastResponse.settings.overlayCorner, 'bottom-left');
  assert.equal(video.playbackRate, 1.75);

  // Storage change on showOverlay when rememberSpeed is false must NOT overwrite active speed
  for (const listener of chromeApi._storageListeners) {
    listener({ showOverlay: { newValue: false } }, 'sync');
  }
  assert.equal(video.playbackRate, 1.75);

  controller.handleRuntimeMessage({ type: MESSAGE_TYPES.RESET_SPEED }, {}, reply);
  assert.equal(lastResponse.speed, 1.0);
  assert.equal(video.playbackRate, 1.0);

  controller.destroy();
});

