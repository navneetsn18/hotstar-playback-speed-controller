(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HotstarSpeedShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4.0;
  const DEFAULT_SPEED = 1.0;

  const SPEED_PRESETS = Object.freeze([
    0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0
  ]);

  const STEP_OPTIONS = Object.freeze([0.05, 0.1, 0.25, 0.5]);

  const CORNER_OPTIONS = Object.freeze([
    'top-right',
    'top-left',
    'bottom-right',
    'bottom-left'
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    speed: DEFAULT_SPEED,
    rememberSpeed: true,
    step: 0.25,
    showOverlay: true,
    autoHideOverlay: true,
    overlayCorner: 'top-right',
    preservesPitch: true,
    showToast: true,
    shortcuts: Object.freeze({
      enabled: true,
      increaseKey: ']',
      decreaseKey: '[',
      resetKey: '\\',
      youtubeShortcuts: true
    })
  });

  const MESSAGE_TYPES = Object.freeze({
    GET_STATUS: 'HS_SPEED_GET_STATUS',
    SET_SPEED: 'HS_SPEED_SET_SPEED',
    STEP_SPEED: 'HS_SPEED_STEP_SPEED',
    RESET_SPEED: 'HS_SPEED_RESET_SPEED',
    UPDATE_SETTINGS: 'HS_SPEED_UPDATE_SETTINGS',
    STATUS_CHANGED: 'HS_SPEED_STATUS_CHANGED'
  });

  /**
   * Round a speed value to 2 decimal places to avoid IEEE 754 float drift.
   * @param {number} value
   * @returns {number}
   */
  function roundSpeed(value) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Clamp and sanitize a playback rate into [MIN_SPEED, MAX_SPEED].
   * @param {unknown} value
   * @returns {number}
   */
  function clampSpeed(value) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return DEFAULT_SPEED;
    }
    const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, num));
    return roundSpeed(clamped);
  }

  /**
   * Adjust speed by a delta and clamp to valid bounds.
   * @param {number} current
   * @param {number} delta
   * @returns {number}
   */
  function stepSpeed(current, delta) {
    const base = clampSpeed(current);
    const step = typeof delta === 'number' && Number.isFinite(delta) ? delta : 0;
    return clampSpeed(roundSpeed(base + step));
  }

  /**
   * Format speed cleanly for UI display (e.g., 1 -> "1.0x", 1.25 -> "1.25x").
   * @param {unknown} value
   * @returns {string}
   */
  function formatSpeed(value) {
    const clean = clampSpeed(value);
    const str = Number.isInteger(clean) ? clean.toFixed(1) : String(clean);
    return `${str}x`;
  }

  /**
   * Normalize a shortcut key string to a single trimmed key representation.
   * @param {unknown} key
   * @param {string} fallback
   * @returns {string}
   */
  function normalizeKey(key, fallback) {
    if (typeof key !== 'string') return fallback;
    const trimmed = key.trim();
    if (!trimmed) return fallback;
    return trimmed.length === 1 ? trimmed : trimmed;
  }

  /**
   * Deep-merge and validate raw storage settings against DEFAULT_SETTINGS.
   * @param {Record<string, any> | null | undefined} raw
   * @returns {typeof DEFAULT_SETTINGS}
   */
  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const rawShortcuts =
      src.shortcuts && typeof src.shortcuts === 'object' ? src.shortcuts : {};

    const stepNum = Number(src.step);
    const validStep =
      Number.isFinite(stepNum) && stepNum >= 0.05 && stepNum <= 1.0
        ? roundSpeed(stepNum)
        : DEFAULT_SETTINGS.step;

    const validCorner = CORNER_OPTIONS.includes(src.overlayCorner)
      ? src.overlayCorner
      : DEFAULT_SETTINGS.overlayCorner;

    return {
      enabled:
        typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
      speed: clampSpeed(
        src.speed !== undefined ? src.speed : DEFAULT_SETTINGS.speed
      ),
      rememberSpeed:
        typeof src.rememberSpeed === 'boolean'
          ? src.rememberSpeed
          : DEFAULT_SETTINGS.rememberSpeed,
      step: validStep,
      showOverlay:
        typeof src.showOverlay === 'boolean'
          ? src.showOverlay
          : DEFAULT_SETTINGS.showOverlay,
      autoHideOverlay:
        typeof src.autoHideOverlay === 'boolean'
          ? src.autoHideOverlay
          : DEFAULT_SETTINGS.autoHideOverlay,
      overlayCorner: validCorner,
      preservesPitch:
        typeof src.preservesPitch === 'boolean'
          ? src.preservesPitch
          : DEFAULT_SETTINGS.preservesPitch,
      showToast:
        typeof src.showToast === 'boolean'
          ? src.showToast
          : DEFAULT_SETTINGS.showToast,
      shortcuts: {
        enabled:
          typeof rawShortcuts.enabled === 'boolean'
            ? rawShortcuts.enabled
            : DEFAULT_SETTINGS.shortcuts.enabled,
        increaseKey: normalizeKey(
          rawShortcuts.increaseKey,
          DEFAULT_SETTINGS.shortcuts.increaseKey
        ),
        decreaseKey: normalizeKey(
          rawShortcuts.decreaseKey,
          DEFAULT_SETTINGS.shortcuts.decreaseKey
        ),
        resetKey: normalizeKey(
          rawShortcuts.resetKey,
          DEFAULT_SETTINGS.shortcuts.resetKey
        ),
        youtubeShortcuts:
          typeof rawShortcuts.youtubeShortcuts === 'boolean'
            ? rawShortcuts.youtubeShortcuts
            : DEFAULT_SETTINGS.shortcuts.youtubeShortcuts
      }
    };
  }

  /**
   * Check whether a URL belongs to Hotstar or JioHotstar.
   * @param {string | undefined | null} urlString
   * @returns {boolean}
   */
  function isHotstarUrl(urlString) {
    if (typeof urlString !== 'string' || !urlString) return false;
    try {
      const parsed = new URL(urlString);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'hotstar.com' ||
        host.endsWith('.hotstar.com') ||
        host === 'jiohotstar.com' ||
        host.endsWith('.jiohotstar.com')
      );
    } catch (_err) {
      return false;
    }
  }

  /**
   * Determine if an event target is an editable text input where shortcuts must be ignored.
   * @param {EventTarget | null} target
   * @returns {boolean}
   */
  function isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    if (target.isContentEditable) return true;
    const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    if (typeof target.closest === 'function') {
      const editableAncestor = target.closest(
        'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
      );
      if (editableAncestor) return true;
    }
    return false;
  }

  function keysEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length === 1 && b.length === 1) {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  /**
   * Match a KeyboardEvent against configured playback speed shortcuts.
   * @param {KeyboardEvent} event
   * @param {ReturnType<typeof normalizeSettings>} settings
   * @returns {'increase' | 'decrease' | 'reset' | null}
   */
  function matchShortcut(event, settings) {
    if (!event || !settings || !settings.enabled) return null;
    const shortcuts = settings.shortcuts || DEFAULT_SETTINGS.shortcuts;
    if (!shortcuts.enabled) return null;
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    if (isEditableTarget(event.target)) return null;

    const key = event.key === ' ' ? 'Space' : event.key;
    if (!key) return null;

    if (shortcuts.youtubeShortcuts && event.shiftKey) {
      if (key === '>' || key === '.') return 'increase';
      if (key === '<' || key === ',') return 'decrease';
    }

    if (keysEqual(key, shortcuts.increaseKey)) return 'increase';
    if (keysEqual(key, shortcuts.decreaseKey)) return 'decrease';
    if (keysEqual(key, shortcuts.resetKey)) return 'reset';

    return null;
  }

  function getStorageArea() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.sync || chrome.storage.local || null;
    }
    return null;
  }

  /**
   * Load settings from Chrome extension storage.
   * @returns {Promise<ReturnType<typeof normalizeSettings>>}
   */
  function loadSettings() {
    const area = getStorageArea();
    if (!area) {
      return Promise.resolve(normalizeSettings(null));
    }
    return new Promise((resolve) => {
      try {
        area.get(DEFAULT_SETTINGS, (items) => {
          resolve(normalizeSettings(items));
        });
      } catch (_err) {
        resolve(normalizeSettings(null));
      }
    });
  }

  /**
   * Persist settings into Chrome extension storage.
   * @param {Partial<typeof DEFAULT_SETTINGS>} nextSettings
   * @returns {Promise<ReturnType<typeof normalizeSettings>>}
   */
  function saveSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    const area = getStorageArea();
    if (!area) {
      return Promise.resolve(normalized);
    }
    return new Promise((resolve) => {
      try {
        area.set(normalized, () => {
          resolve(normalized);
        });
      } catch (_err) {
        resolve(normalized);
      }
    });
  }

  return {
    MIN_SPEED,
    MAX_SPEED,
    DEFAULT_SPEED,
    SPEED_PRESETS,
    STEP_OPTIONS,
    CORNER_OPTIONS,
    DEFAULT_SETTINGS,
    MESSAGE_TYPES,
    roundSpeed,
    clampSpeed,
    stepSpeed,
    formatSpeed,
    normalizeSettings,
    isHotstarUrl,
    isEditableTarget,
    matchShortcut,
    loadSettings,
    saveSettings
  };
});
