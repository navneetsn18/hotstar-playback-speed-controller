(function () {
  'use strict';

  const Shared = window.HotstarSpeedShared;
  const {
    SPEED_PRESETS,
    DEFAULT_SPEED,
    MESSAGE_TYPES,
    clampSpeed,
    stepSpeed,
    formatSpeed,
    normalizeSettings,
    isHotstarUrl,
    loadSettings,
    saveSettings
  } = Shared;

  const els = {
    statusBadge: document.getElementById('status-badge'),
    toggleEnabled: document.getElementById('toggle-enabled'),
    mainContent: document.getElementById('main-content'),
    speedValue: document.getElementById('speed-value'),
    btnDecrease: document.getElementById('btn-decrease'),
    btnIncrease: document.getElementById('btn-increase'),
    btnReset: document.getElementById('btn-reset'),
    speedSlider: document.getElementById('speed-slider'),
    presetsGrid: document.getElementById('presets-grid'),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsBody: document.getElementById('settings-body'),
    selectStep: document.getElementById('select-step'),
    selectCorner: document.getElementById('select-corner'),
    chkOverlay: document.getElementById('chk-overlay'),
    chkAutohide: document.getElementById('chk-autohide'),
    chkToast: document.getElementById('chk-toast'),
    chkRemember: document.getElementById('chk-remember'),
    chkPitch: document.getElementById('chk-pitch'),
    chkShortcuts: document.getElementById('chk-shortcuts'),
    chkYtShortcuts: document.getElementById('chk-yt-shortcuts'),
    keyDecrease: document.getElementById('key-decrease'),
    keyIncrease: document.getElementById('key-increase'),
    keyReset: document.getElementById('key-reset')
  };

  let activeTabId = null;
  let activeTabIsHotstar = false;
  let hasLiveVideo = false;
  let contentScriptReachable = false;
  let currentSpeed = DEFAULT_SPEED;
  let settings = normalizeSettings(null);
  let recordingButton = null;
  const presetButtons = new Map();

  function buildPresetButtons() {
    els.presetsGrid.innerHTML = '';
    presetButtons.clear();
    SPEED_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.textContent = formatSpeed(preset);
      btn.addEventListener('click', () => {
        setSpeed(preset);
      });
      els.presetsGrid.appendChild(btn);
      presetButtons.set(preset, btn);
    });
  }

  function updateStatusBadge() {
    els.statusBadge.classList.remove('is-live', 'is-idle');
    if (!activeTabIsHotstar) {
      els.statusBadge.textContent = 'Open hotstar.com to control';
      return;
    }
    if (!contentScriptReachable) {
      els.statusBadge.textContent = 'Refresh Hotstar tab';
      els.statusBadge.classList.add('is-idle');
      return;
    }
    if (hasLiveVideo) {
      els.statusBadge.textContent = 'Connected to player';
      els.statusBadge.classList.add('is-live');
    } else {
      els.statusBadge.textContent = 'Hotstar open (no video)';
      els.statusBadge.classList.add('is-idle');
    }
  }

  function renderUI() {
    const label = formatSpeed(currentSpeed);
    els.toggleEnabled.checked = settings.enabled;
    if (settings.enabled) {
      els.mainContent.classList.remove('is-disabled');
    } else {
      els.mainContent.classList.add('is-disabled');
    }

    els.speedValue.textContent = label;
    els.speedSlider.value = String(currentSpeed);

    for (const [preset, btn] of presetButtons.entries()) {
      if (Math.abs(preset - currentSpeed) <= 0.001) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    }

    els.selectStep.value = String(settings.step);
    els.selectCorner.value = settings.overlayCorner;
    els.chkOverlay.checked = settings.showOverlay;
    els.chkAutohide.checked = settings.autoHideOverlay;
    els.chkToast.checked = settings.showToast;
    els.chkRemember.checked = settings.rememberSpeed;
    els.chkPitch.checked = settings.preservesPitch;
    els.chkShortcuts.checked = settings.shortcuts.enabled;
    els.chkYtShortcuts.checked = settings.shortcuts.youtubeShortcuts;

    if (!recordingButton || recordingButton !== els.keyDecrease) {
      els.keyDecrease.textContent = formatKeyLabel(settings.shortcuts.decreaseKey);
    }
    if (!recordingButton || recordingButton !== els.keyIncrease) {
      els.keyIncrease.textContent = formatKeyLabel(settings.shortcuts.increaseKey);
    }
    if (!recordingButton || recordingButton !== els.keyReset) {
      els.keyReset.textContent = formatKeyLabel(settings.shortcuts.resetKey);
    }

    updateStatusBadge();
  }

  function formatKeyLabel(key) {
    if (key === ' ') return 'Space';
    return key;
  }

  async function sendToActiveTab(payload) {
    if (!activeTabId || !activeTabIsHotstar || !chrome.tabs || !chrome.tabs.sendMessage) {
      return null;
    }
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, payload);
      contentScriptReachable = true;
      return response;
    } catch (_err) {
      contentScriptReachable = false;
      return null;
    }
  }

  async function setSpeed(nextSpeed) {
    const clamped = clampSpeed(nextSpeed);
    currentSpeed = clamped;
    if (settings.rememberSpeed) {
      settings = normalizeSettings({ ...settings, speed: clamped });
      await saveSettings(settings);
    }
    renderUI();

    const status = await sendToActiveTab({
      type: MESSAGE_TYPES.SET_SPEED,
      speed: clamped,
      toast: true
    });
    if (status) {
      hasLiveVideo = Boolean(status.hasVideo);
      currentSpeed = clampSpeed(status.speed);
      renderUI();
    }
  }

  async function resetSpeed() {
    currentSpeed = DEFAULT_SPEED;
    if (settings.rememberSpeed) {
      settings = normalizeSettings({ ...settings, speed: DEFAULT_SPEED });
      await saveSettings(settings);
    }
    renderUI();

    const status = await sendToActiveTab({
      type: MESSAGE_TYPES.RESET_SPEED,
      toast: true
    });
    if (status) {
      hasLiveVideo = Boolean(status.hasVideo);
      currentSpeed = clampSpeed(status.speed);
      renderUI();
    }
  }

  async function updateSettingsPatch(patch) {
    settings = normalizeSettings({
      ...settings,
      ...patch,
      shortcuts: {
        ...settings.shortcuts,
        ...(patch.shortcuts || {})
      }
    });
    await saveSettings(settings);
    renderUI();

    const status = await sendToActiveTab({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      settings: patch
    });
    if (status) {
      hasLiveVideo = Boolean(status.hasVideo);
      currentSpeed = clampSpeed(status.speed);
      settings = normalizeSettings(status.settings);
      renderUI();
    }
  }

  function startRecordingKey(btn) {
    if (recordingButton) {
      recordingButton.classList.remove('is-recording');
    }
    recordingButton = btn;
    btn.classList.add('is-recording');
    btn.textContent = 'Press key...';
  }

  function stopRecordingKey() {
    if (!recordingButton) return;
    recordingButton.classList.remove('is-recording');
    recordingButton = null;
    renderUI();
  }

  function attachEvents() {
    els.toggleEnabled.addEventListener('change', () => {
      updateSettingsPatch({ enabled: els.toggleEnabled.checked });
    });

    els.btnDecrease.addEventListener('click', () => {
      setSpeed(stepSpeed(currentSpeed, -settings.step));
    });

    els.btnIncrease.addEventListener('click', () => {
      setSpeed(stepSpeed(currentSpeed, settings.step));
    });

    els.btnReset.addEventListener('click', () => {
      resetSpeed();
    });

    els.speedSlider.addEventListener('input', () => {
      setSpeed(parseFloat(els.speedSlider.value));
    });

    els.settingsToggle.addEventListener('click', () => {
      const expanded = els.settingsToggle.getAttribute('aria-expanded') === 'true';
      els.settingsToggle.setAttribute('aria-expanded', String(!expanded));
      els.settingsBody.classList.toggle('is-collapsed', expanded);
    });

    els.selectStep.addEventListener('change', () => {
      updateSettingsPatch({ step: parseFloat(els.selectStep.value) });
    });

    els.selectCorner.addEventListener('change', () => {
      updateSettingsPatch({ overlayCorner: els.selectCorner.value });
    });

    els.chkOverlay.addEventListener('change', () => {
      updateSettingsPatch({ showOverlay: els.chkOverlay.checked });
    });

    els.chkAutohide.addEventListener('change', () => {
      updateSettingsPatch({ autoHideOverlay: els.chkAutohide.checked });
    });

    els.chkToast.addEventListener('change', () => {
      updateSettingsPatch({ showToast: els.chkToast.checked });
    });

    els.chkRemember.addEventListener('change', () => {
      const remember = els.chkRemember.checked;
      updateSettingsPatch({
        rememberSpeed: remember,
        speed: remember ? currentSpeed : settings.speed
      });
    });

    els.chkPitch.addEventListener('change', () => {
      updateSettingsPatch({ preservesPitch: els.chkPitch.checked });
    });

    els.chkShortcuts.addEventListener('change', () => {
      updateSettingsPatch({ shortcuts: { enabled: els.chkShortcuts.checked } });
    });

    els.chkYtShortcuts.addEventListener('change', () => {
      updateSettingsPatch({
        shortcuts: { youtubeShortcuts: els.chkYtShortcuts.checked }
      });
    });

    [els.keyDecrease, els.keyIncrease, els.keyReset].forEach((btn) => {
      btn.addEventListener('click', () => {
        if (recordingButton === btn) {
          stopRecordingKey();
        } else {
          startRecordingKey(btn);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (!recordingButton) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        stopRecordingKey();
        return;
      }

      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const field = recordingButton.dataset.keyField;
      const key = e.key === ' ' ? 'Space' : e.key;
      recordingButton.classList.remove('is-recording');
      recordingButton = null;
      updateSettingsPatch({ shortcuts: { [field]: key } });
    });

    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message && message.type === MESSAGE_TYPES.STATUS_CHANGED && message.status) {
          hasLiveVideo = Boolean(message.status.hasVideo);
          currentSpeed = clampSpeed(message.status.speed);
          if (message.status.settings) {
            settings = normalizeSettings(message.status.settings);
          }
          renderUI();
        }
      });
    }
  }

  async function init() {
    buildPresetButtons();
    attachEvents();

    settings = await loadSettings();
    currentSpeed = settings.rememberSpeed ? settings.speed : DEFAULT_SPEED;

    if (chrome.tabs && chrome.tabs.query) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0];
        if (tab) {
          activeTabId = tab.id;
          activeTabIsHotstar = isHotstarUrl(tab.url);
        }
      } catch (_err) {
        activeTabIsHotstar = false;
      }
    }

    if (activeTabIsHotstar && activeTabId) {
      const status = await sendToActiveTab({ type: MESSAGE_TYPES.GET_STATUS });
      if (status) {
        hasLiveVideo = Boolean(status.hasVideo);
        currentSpeed = clampSpeed(status.speed);
        if (status.settings) {
          settings = normalizeSettings(status.settings);
        }
      }
    }

    renderUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
