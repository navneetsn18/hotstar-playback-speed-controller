const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

test('manifest.json is valid MV3 and all referenced assets exist', () => {
  const manifestPath = path.join(ROOT, 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name);
  assert.ok(manifest.version);
  assert.ok(Array.isArray(manifest.permissions));
  assert.ok(manifest.permissions.includes('storage'));

  // Check popup
  assert.ok(manifest.action && manifest.action.default_popup);
  assert.ok(fs.existsSync(path.join(ROOT, manifest.action.default_popup)));

  // Check icons (PNG magic bytes)
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const [size, relPath] of Object.entries(manifest.icons)) {
    const abs = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(abs), `Missing icon ${size}: ${relPath}`);
    const buf = fs.readFileSync(abs);
    assert.ok(buf.subarray(0, 8).equals(pngSig), `Invalid PNG signature for ${relPath}`);
  }

  // Check content scripts & CSS
  assert.ok(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0);
  for (const cs of manifest.content_scripts) {
    assert.ok(cs.matches.includes('https://*.hotstar.com/*'));
    assert.ok(cs.matches.includes('https://*.jiohotstar.com/*'));
    for (const jsRel of cs.js || []) {
      const abs = path.join(ROOT, jsRel);
      assert.ok(fs.existsSync(abs), `Missing content script: ${jsRel}`);
    }
    for (const cssRel of cs.css || []) {
      const abs = path.join(ROOT, cssRel);
      assert.ok(fs.existsSync(abs), `Missing content CSS: ${cssRel}`);
    }
  }
});

test('all extension JS files parse cleanly without syntax errors', () => {
  const jsFiles = [
    'src/shared/constants.js',
    'src/content/speed-engine.js',
    'src/content/player-ui.js',
    'src/content/content.js',
    'src/popup/popup.js'
  ];

  for (const rel of jsFiles) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: rel }), `Syntax error in ${rel}`);
  }
});

