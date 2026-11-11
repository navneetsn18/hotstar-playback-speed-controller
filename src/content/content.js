(function (root, factory) {
  const shared =
    typeof module === 'object' && module.exports
      ? require('../shared/constants')
      : root.HotstarSpeedShared;
  const engineMod =
    typeof module === 'object' && module.exports
      ? require('./speed-engine')
      : root.HotstarSpeedEngine;
  const uiMod =
    typeof module === 'object' && module.exports
      ? require('./player-ui')
      : root.HotstarSpeedPlayerUI;

  const api = factory(shared, engineMod, uiMod);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HotstarSpeedController = api;

  if (
    typeof module !== 'object' &&
    typeof document !== 'undefined' &&
    typeof window !== 'undefined'
  ) {
    // Prevent duplicate initialization if injected more than once
    if (!window.__hotstarSpeedControllerInstance) {
      const controller = api.createController({
        document,
        window,
        chromeApi: typeof chrome !== 'undefined' ? chrome : null
      });
      window.__hotstarSpeedControllerInstance = controller;
      controller.init();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared, EngineMod, UIMod) {
  'use strict';

  const {
    DEFAULT_SPEED,
    MESSAGE_TYPES,
    clampSpeed,
    stepSpeed,
    normalizeSettings,
    matchShortcut,
    loadSettings,
    saveSettings
  } = Shared;
  const { SpeedEngine } = EngineMod;
  const { PlayerUI } = UIMod;

  function createController(options = {}) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null);
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    const chromeApi = options.chromeApi !== undefined ? options.chromeApi : null;

    let settings = normalizeSettings(null);
    let currentSpeed = DEFAULT_SPEED;
    let lastCustomSpeed = 1.5;
    let engine = null;
    let ui = null;
    let destroyed = false;
    const cleanups = [];

    function getStatus() {
      const primary = engine ? engine.primaryVideo : null;
      return {
        hasVideo: Boolean(primary),
        paused: primary ? Boolean(primary.paused) : true,
        speed: currentSpeed,
        settings
      };
    }

    function notifyPopup() {
      if (!chromeApi || !chromeApi.runtime || !chromeApi.runtime.sendMessage) return;
      try {
        const res = chromeApi.runtime.sendMessage({
          type: MESSAGE_TYPES.STATUS_CHANGED,
          status: getStatus()
        });
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_err) {
        // Popup may be closed; safe to ignore
      }
    }

    function persistCurrentSpeed(speed) {
      if (!settings.rememberSpeed) return;
      settings = normalizeSettings({ ...settings, speed });
      if (chromeApi && chromeApi.storage) {
        saveSettings(settings);
      }
    }

    function applySpeed(nextSpeed, opts = {}) {
      const clamped = clampSpeed(nextSpeed);
      if (Math.abs(clamped - DEFAULT_SPEED) > 0.001) {
        lastCustomSpeed = clamped;
      }
      currentSpeed = clamped;

      if (engine) {
        engine.setTargetSpeed(clamped);
      }
      if (ui) {
        ui.setSpeed(clamped, { toast: Boolean(opts.toast) });
      }
      if (opts.persist !== false) {
        persistCurrentSpeed(clamped);
      }
      notifyPopup();
      return clamped;
    }

    function applyStep(direction, opts = {}) {
      const delta = (direction >= 0 ? 1 : -1) * settings.step;
      const next = stepSpeed(currentSpeed, delta);
      return applySpeed(next, opts);
    }

    function resetToNormal(opts = {}) {
      return applySpeed(DEFAULT_SPEED, opts);
    }

    function toggleResetSpeed(opts = {}) {
      if (Math.abs(currentSpeed - DEFAULT_SPEED) > 0.001) {
        lastCustomSpeed = currentSpeed;
        return applySpeed(DEFAULT_SPEED, opts);
      }
      if (lastCustomSpeed && Math.abs(lastCustomSpeed - DEFAULT_SPEED) > 0.001) {
        return applySpeed(lastCustomSpeed, opts);
      }
      return applySpeed(DEFAULT_SPEED, opts);
    }

    function applySettings(nextRawSettings, opts = {}) {
      const normalized = normalizeSettings(nextRawSettings);
      settings = normalized;

      if (opts.useStoredSpeed) {
        currentSpeed = settings.rememberSpeed ? settings.speed : DEFAULT_SPEED;
      } else if (opts.applySpeed && nextRawSettings && nextRawSettings.speed !== undefined) {
        currentSpeed = clampSpeed(nextRawSettings.speed);
      }

      if (Math.abs(currentSpeed - DEFAULT_SPEED) > 0.001) {
        lastCustomSpeed = currentSpeed;
      }

      if (engine) {
        engine.setEnabled(settings.enabled);
        engine.setPreservesPitch(settings.preservesPitch);
        engine.setTargetSpeed(currentSpeed);
      }
      if (ui) {
        ui.setSettings({ ...settings, speed: currentSpeed });
      }
      notifyPopup();
      return settings;
    }

    function handleKeyDown(event) {
      if (destroyed || !settings.enabled) return;
      if (!engine || !engine.primaryVideo) return;

      const action = matchShortcut(event, settings);
      if (!action) return;

      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();

      if (action === 'increase') {
        applyStep(1, { toast: true });
      } else if (action === 'decrease') {
        applyStep(-1, { toast: true });
      } else if (action === 'reset') {
        toggleResetSpeed({ toast: true });
      }
    }

    function handleRuntimeMessage(message, _sender, sendResponse) {
      if (!message || typeof message !== 'object') return false;

      switch (message.type) {
        case MESSAGE_TYPES.GET_STATUS: {
          sendResponse(getStatus());
          return false;
        }
        case MESSAGE_TYPES.SET_SPEED: {
          applySpeed(message.speed, { toast: Boolean(message.toast) });
          sendResponse(getStatus());
          return false;
        }
        case MESSAGE_TYPES.STEP_SPEED: {
          applyStep(Number(message.direction) || 1, { toast: Boolean(message.toast) });
          sendResponse(getStatus());
          return false;
        }
        case MESSAGE_TYPES.RESET_SPEED: {
          resetToNormal({ toast: Boolean(message.toast) });
          sendResponse(getStatus());
          return false;
        }
        case MESSAGE_TYPES.UPDATE_SETTINGS: {
          const patch = message.settings || {};
          const merged = normalizeSettings({ ...settings, ...patch });
          applySettings(merged, { applySpeed: patch.speed !== undefined });
          if (chromeApi && chromeApi.storage) {
            saveSettings(merged);
          }
          sendResponse(getStatus());
          return false;
        }
        default:
          return false;
      }
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== 'sync' && areaName !== 'local') return;
      const updated = { ...settings };
      let hasRelevant = false;
      for (const key of Object.keys(changes)) {
        if (key in updated) {
          updated[key] = changes[key].newValue;
          hasRelevant = true;
        }
      }
      if (hasRelevant) {
        applySettings(updated, {
          useStoredSpeed: Boolean(changes.speed && updated.rememberSpeed)
        });
      }
    }

    async function init() {
      if (destroyed) return;
      const loaded = chromeApi && chromeApi.storage ? await loadSettings() : normalizeSettings(null);
      settings = loaded;
      currentSpeed = settings.rememberSpeed ? settings.speed : DEFAULT_SPEED;
      if (Math.abs(currentSpeed - DEFAULT_SPEED) > 0.001) {
        lastCustomSpeed = currentSpeed;
      }

      ui = new PlayerUI({
        document: doc,
        window: win,
        onSelectSpeed: (speed) => applySpeed(speed, { toast: false }),
        onStepSpeed: (direction) => applyStep(direction, { toast: false }),
        onResetSpeed: () => resetToNormal({ toast: false })
      });
      ui.init();
      ui.setSettings({ ...settings, speed: currentSpeed });

      engine = new SpeedEngine({
        document: doc,
        speed: currentSpeed,
        enabled: settings.enabled,
        preservesPitch: settings.preservesPitch,
        onPrimaryVideoChange: (video) => {
          if (ui) ui.setVideo(video);
          notifyPopup();
        }
      });
      engine.start();
      if (ui && engine.primaryVideo) {
        ui.setVideo(engine.primaryVideo);
      }

      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('keydown', handleKeyDown, true);
        cleanups.push(() => doc.removeEventListener('keydown', handleKeyDown, true));
      }

      if (chromeApi && chromeApi.runtime && chromeApi.runtime.onMessage) {
        chromeApi.runtime.onMessage.addListener(handleRuntimeMessage);
        cleanups.push(() => chromeApi.runtime.onMessage.removeListener(handleRuntimeMessage));
      }

      if (chromeApi && chromeApi.storage && chromeApi.storage.onChanged) {
        chromeApi.storage.onChanged.addListener(handleStorageChange);
        cleanups.push(() => chromeApi.storage.onChanged.removeListener(handleStorageChange));
      }
    }

    function destroy() {
      destroyed = true;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      if (engine) {
        engine.destroy();
        engine = null;
      }
      if (ui) {
        ui.destroy();
        ui = null;
      }
    }

    return {
      init,
      destroy,
      getStatus,
      applySpeed,
      applyStep,
      resetToNormal,
      toggleResetSpeed,
      applySettings,
      handleKeyDown,
      handleRuntimeMessage
    };
  }

  return { createController };
});
