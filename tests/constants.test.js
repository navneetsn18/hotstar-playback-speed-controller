const test = require('node:test');
const assert = require('node:assert/strict');
const Shared = require('../src/shared/constants');

test('clampSpeed clamps bounds and avoids NaN', () => {
  assert.equal(Shared.clampSpeed(0.1), 0.25);
  assert.equal(Shared.clampSpeed(10), 4.0);
  assert.equal(Shared.clampSpeed(1.5), 1.5);
  assert.equal(Shared.clampSpeed('2.25'), 2.25);
  assert.equal(Shared.clampSpeed('invalid'), 1.0);
  assert.equal(Shared.clampSpeed(undefined), 1.0);
});

test('stepSpeed avoids floating-point drift', () => {
  assert.equal(Shared.stepSpeed(1.1, 0.1), 1.2);
  assert.equal(Shared.stepSpeed(1.2, 0.1), 1.3);
  assert.equal(Shared.stepSpeed(0.3, -0.1), 0.25);
  assert.equal(Shared.stepSpeed(3.9, 0.25), 4.0);
});

test('formatSpeed formats cleanly', () => {
  assert.equal(Shared.formatSpeed(1), '1.0x');
  assert.equal(Shared.formatSpeed(1.25), '1.25x');
  assert.equal(Shared.formatSpeed(1.5), '1.5x');
  assert.equal(Shared.formatSpeed(2), '2.0x');
});

test('normalizeSettings merges defaults and sanitizes invalid values', () => {
  const s = Shared.normalizeSettings({
    speed: 99,
    step: 99,
    overlayCorner: 'invalid-corner',
    shortcuts: { increaseKey: '   ', decreaseKey: 's' }
  });
  assert.equal(s.speed, 4.0);
  assert.equal(s.step, 0.25);
  assert.equal(s.overlayCorner, 'top-right');
  assert.equal(s.shortcuts.increaseKey, ']');
  assert.equal(s.shortcuts.decreaseKey, 's');
  assert.equal(s.shortcuts.resetKey, '\\');
});

test('isHotstarUrl recognizes hotstar.com and jiohotstar.com subdomains', () => {
  assert.equal(Shared.isHotstarUrl('https://www.hotstar.com/in/home'), true);
  assert.equal(Shared.isHotstarUrl('https://hotstar.com/watch/123'), true);
  assert.equal(Shared.isHotstarUrl('https://www.jiohotstar.com/in'), true);
  assert.equal(Shared.isHotstarUrl('https://www.youtube.com/watch?v=1'), false);
  assert.equal(Shared.isHotstarUrl('https://nothotstar.com/'), false);
  assert.equal(Shared.isHotstarUrl('not-a-url'), false);
});

test('matchShortcut handles custom keys, YouTube keys, and editable guards', () => {
  const settings = Shared.normalizeSettings(null);

  assert.equal(Shared.matchShortcut({ key: ']', target: { tagName: 'BODY' } }, settings), 'increase');
  assert.equal(Shared.matchShortcut({ key: '[', target: { tagName: 'DIV' } }, settings), 'decrease');
  assert.equal(Shared.matchShortcut({ key: '\\', target: { tagName: 'DIV' } }, settings), 'reset');

  // YouTube Shift+< / Shift+>
  assert.equal(
    Shared.matchShortcut({ key: '>', shiftKey: true, target: { tagName: 'BODY' } }, settings),
    'increase'
  );
  assert.equal(
    Shared.matchShortcut({ key: '<', shiftKey: true, target: { tagName: 'BODY' } }, settings),
    'decrease'
  );

  // Ignore typing inside input/textarea/contentEditable
  assert.equal(Shared.matchShortcut({ key: ']', target: { tagName: 'INPUT' } }, settings), null);
  assert.equal(Shared.matchShortcut({ key: ']', target: { tagName: 'TEXTAREA' } }, settings), null);
  assert.equal(
    Shared.matchShortcut({ key: ']', target: { tagName: 'DIV', isContentEditable: true } }, settings),
    null
  );

  // Ignore Ctrl/Cmd/Alt combos
  assert.equal(
    Shared.matchShortcut({ key: ']', ctrlKey: true, target: { tagName: 'BODY' } }, settings),
    null
  );
  assert.equal(
    Shared.matchShortcut({ key: ']', metaKey: true, target: { tagName: 'BODY' } }, settings),
    null
  );
});

