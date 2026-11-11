const test = require('node:test');
const assert = require('node:assert/strict');
const { MockDocument, MockVideoElement } = require('./dom-mock');
const { SpeedEngine } = require('../src/content/speed-engine');

test('SpeedEngine applies target speed on initial video and enforces against external rate resets', (t) => {
  const doc = new MockDocument();
  const video = new MockVideoElement(doc);
  doc.body.appendChild(video);

  const engine = new SpeedEngine({
    document: doc,
    speed: 1.5,
    enabled: true,
    preservesPitch: true
  });
  t.after(() => engine.destroy());
  engine.start();

  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.defaultPlaybackRate, 1.5);
  assert.equal(video.preservesPitch, true);
  assert.equal(engine.primaryVideo, video);

  // Simulate Hotstar resetting playbackRate back to 1.0 during episode/ad/quality change
  video.playbackRate = 1.0;
  assert.equal(video.playbackRate, 1.5);

  engine.destroy();
});

test('SpeedEngine restores 1.0x when disabled and re-enforces when re-enabled', (t) => {
  const doc = new MockDocument();
  const video = new MockVideoElement(doc);
  doc.body.appendChild(video);

  const engine = new SpeedEngine({ document: doc, speed: 2.0, enabled: true });
  t.after(() => engine.destroy());
  engine.start();
  assert.equal(video.playbackRate, 2.0);

  engine.setEnabled(false);
  assert.equal(video.playbackRate, 1.0);

  // External change while disabled should not be overridden
  video.playbackRate = 1.25;
  assert.equal(video.playbackRate, 1.25);

  engine.setEnabled(true);
  assert.equal(video.playbackRate, 2.0);

  engine.destroy();
});

test('SpeedEngine scores primary video properly over muted hover preview thumbnails', (t) => {
  const doc = new MockDocument();
  const previewVideo = new MockVideoElement(doc, {
    paused: true,
    muted: true,
    readyState: 1,
    rect: { top: 0, left: 0, width: 160, height: 90 }
  });
  const mainVideo = new MockVideoElement(doc, {
    paused: false,
    muted: false,
    readyState: 4,
    rect: { top: 60, left: 0, width: 1280, height: 720 }
  });

  doc.body.appendChild(previewVideo);
  doc.body.appendChild(mainVideo);

  const engine = new SpeedEngine({ document: doc, speed: 1.25, enabled: true });
  t.after(() => engine.destroy());
  engine.start();

  assert.equal(engine.primaryVideo, mainVideo);
  assert.equal(mainVideo.playbackRate, 1.25);

  // Fullscreen element prioritizes its contained video
  doc.fullscreenElement = previewVideo;
  engine.updatePrimaryVideo();
  assert.equal(engine.primaryVideo, previewVideo);

  engine.destroy();
});

test('SpeedEngine detects dynamically mounted videos via document capture events', (t) => {
  const doc = new MockDocument();
  const engine = new SpeedEngine({ document: doc, speed: 1.75, enabled: true });
  t.after(() => engine.destroy());
  engine.start();

  assert.equal(engine.primaryVideo, null);

  const lateVideo = new MockVideoElement(doc);
  doc.body.appendChild(lateVideo);
  lateVideo.dispatchEvent({ type: 'loadedmetadata', target: lateVideo });
  doc.dispatchEvent({ type: 'loadedmetadata', target: lateVideo });

  assert.equal(engine.primaryVideo, lateVideo);
  assert.equal(lateVideo.playbackRate, 1.75);

  engine.destroy();
});
