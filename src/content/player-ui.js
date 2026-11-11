(function (root, factory) {
  const shared =
    typeof module === 'object' && module.exports
      ? require('../shared/constants')
      : root.HotstarSpeedShared;
  const api = factory(shared);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HotstarSpeedPlayerUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared) {
  'use strict';

  const { SPEED_PRESETS, MIN_SPEED, MAX_SPEED, DEFAULT_SPEED, formatSpeed, clampSpeed } =
    Shared;

  const HOST_ID = 'hotstar-speed-controller-host';

  const SHADOW_STYLES = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    }

    * {
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    }

    .hs-stage {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .hs-corner {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
    }

    .hs-corner.is-hidden {
      opacity: 0;
    }

    .hs-corner.is-hidden .hs-pill,
    .hs-corner.is-hidden .hs-menu {
      pointer-events: none;
    }

    .hs-corner[data-corner="top-right"] {
      top: 18px;
      right: 18px;
      align-items: flex-end;
    }

    .hs-corner[data-corner="top-left"] {
      top: 18px;
      left: 18px;
      align-items: flex-start;
    }

    .hs-corner[data-corner="bottom-right"] {
      bottom: 84px;
      right: 18px;
      align-items: flex-end;
      flex-direction: column-reverse;
    }

    .hs-corner[data-corner="bottom-left"] {
      bottom: 84px;
      left: 18px;
      align-items: flex-start;
      flex-direction: column-reverse;
    }

    .hs-pill {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42);
      color: #f8fafc;
    }

    .hs-pill-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: #e2e8f0;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      height: 28px;
      min-width: 28px;
      padding: 0 7px;
      border-radius: 999px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }

    .hs-pill-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
    }

    .hs-pill-btn:active {
      transform: scale(0.94);
    }

    .hs-pill-badge {
      min-width: 48px;
      padding: 0 9px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }

    .hs-pill-badge.is-modified {
      background: rgba(14, 165, 233, 0.22);
      color: #38bdf8;
    }

    .hs-pill-badge.is-modified:hover {
      background: rgba(14, 165, 233, 0.34);
      color: #7dd3fc;
    }

    .hs-menu {
      pointer-events: auto;
      width: 224px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
      color: #f8fafc;
      display: none;
    }

    .hs-menu.is-open {
      display: block;
    }

    .hs-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    .hs-menu-title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .hs-reset-link {
      appearance: none;
      border: none;
      background: rgba(56, 189, 248, 0.14);
      color: #38bdf8;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .hs-reset-link:hover {
      background: rgba(56, 189, 248, 0.26);
    }

    .hs-presets {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }

    .hs-preset-btn {
      appearance: none;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(30, 41, 59, 0.7);
      color: #e2e8f0;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      padding: 6px 4px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.14s ease;
    }

    .hs-preset-btn:hover {
      border-color: rgba(56, 189, 248, 0.55);
      background: rgba(51, 65, 85, 0.9);
      color: #ffffff;
    }

    .hs-preset-btn.is-active {
      background: #0ea5e9;
      border-color: #38bdf8;
      color: #ffffff;
      font-weight: 700;
    }

    .hs-slider-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hs-slider-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }

    .hs-slider-val {
      color: #38bdf8;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .hs-slider {
      width: 100%;
      accent-color: #38bdf8;
      cursor: pointer;
      margin: 0;
    }

    .hs-toast {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.94);
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.84);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      color: #ffffff;
      font-size: 18px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.16s ease, transform 0.16s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hs-toast.is-visible {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }

    .hs-toast-icon {
      color: #38bdf8;
      font-size: 15px;
    }
  `;

  class PlayerUI {
    /**
     * @param {object} options
     * @param {Document} [options.document]
     * @param {Window} [options.window]
     * @param {(speed: number) => void} options.onSelectSpeed
     * @param {(direction: number) => void} options.onStepSpeed
     * @param {() => void} options.onResetSpeed
     */
    constructor(options) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.onSelectSpeed = options.onSelectSpeed;
      this.onStepSpeed = options.onStepSpeed;
      this.onResetSpeed = options.onResetSpeed;

      this.video = null;
      this.speed = DEFAULT_SPEED;
      this.enabled = true;
      this.showOverlay = true;
      this.autoHideOverlay = true;
      this.overlayCorner = 'top-right';
      this.showToastEnabled = true;

      this.menuOpen = false;
      this.isHovering = false;
      this.hideTimer = null;
      this.toastTimer = null;
      this.rafSyncId = null;

      this.host = null;
      this.shadow = null;
      this.stage = null;
      this.cornerEl = null;
      this.badgeBtn = null;
      this.menuEl = null;
      this.sliderEl = null;
      this.sliderValEl = null;
      this.toastEl = null;
      this.toastTextEl = null;
      this.presetButtons = new Map();

      this.resizeObserver = null;
      this.cleanupHandlers = [];
      this.destroyed = false;
    }

    init() {
      if (!this.doc || this.destroyed) return;
      this.ensureHost();
      this.attachGlobalListeners();
      this.updatePosition();
      this.renderState();
    }

    destroy() {
      this.destroyed = true;
      if (this.hideTimer) clearTimeout(this.hideTimer);
      if (this.toastTimer) clearTimeout(this.toastTimer);
      if (this.rafSyncId && this.win && this.win.cancelAnimationFrame) {
        this.win.cancelAnimationFrame(this.rafSyncId);
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      this.cleanupHandlers.forEach((fn) => fn());
      this.cleanupHandlers = [];
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
      this.host = null;
      this.shadow = null;
    }

    ensureHost() {
      if (!this.doc) return;
      let existing = this.doc.getElementById ? this.doc.getElementById(HOST_ID) : null;
      if (existing && existing === this.host) {
        this.mountHostToTargetParent();
        return;
      }
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      const host = this.doc.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('data-hotstar-speed-ui', 'true');
      this.host = host;

      if (typeof host.attachShadow === 'function') {
        this.shadow = host.attachShadow({ mode: 'open' });
      } else {
        this.shadow = host;
      }

      this.buildShadowTree();
      this.mountHostToTargetParent();
    }

    getFullscreenElement() {
      if (!this.doc) return null;
      return this.doc.fullscreenElement || this.doc.webkitFullscreenElement || null;
    }

    mountHostToTargetParent() {
      if (!this.doc || !this.host) return;
      const fsEl = this.getFullscreenElement();
      const targetParent = fsEl || this.doc.body || this.doc.documentElement;
      if (!targetParent) return;
      if (this.host.parentNode !== targetParent) {
        targetParent.appendChild(this.host);
      }
    }

    stopBubble(el) {
      if (!el || typeof el.addEventListener !== 'function') return;
      ['click', 'mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup'].forEach(
        (evt) => {
          el.addEventListener(evt, (e) => {
            e.stopPropagation();
          });
        }
      );
    }

    buildShadowTree() {
      if (!this.shadow || !this.doc) return;

      const style = this.doc.createElement('style');
      style.textContent = SHADOW_STYLES;
      this.shadow.appendChild(style);

      const stage = this.doc.createElement('div');
      stage.className = 'hs-stage';
      this.stage = stage;

      const corner = this.doc.createElement('div');
      corner.className = 'hs-corner';
      corner.setAttribute('data-corner', this.overlayCorner);
      this.cornerEl = corner;

      const pill = this.doc.createElement('div');
      pill.className = 'hs-pill';
      this.stopBubble(pill);

      pill.addEventListener('mouseenter', () => {
        this.isHovering = true;
        this.revealControls();
      });
      pill.addEventListener('mouseleave', () => {
        this.isHovering = false;
        this.scheduleAutoHide();
      });

      const decBtn = this.doc.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'hs-pill-btn';
      decBtn.setAttribute('aria-label', 'Decrease playback speed');
      decBtn.title = 'Decrease speed';
      decBtn.textContent = '−';
      decBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onStepSpeed(-1);
        this.revealControls();
      });

      const badgeBtn = this.doc.createElement('button');
      badgeBtn.type = 'button';
      badgeBtn.className = 'hs-pill-btn hs-pill-badge';
      badgeBtn.setAttribute('aria-label', 'Open playback speed menu');
      badgeBtn.title = 'Playback speed';
      badgeBtn.textContent = formatSpeed(this.speed);
      badgeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMenu();
      });
      this.badgeBtn = badgeBtn;

      const incBtn = this.doc.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'hs-pill-btn';
      incBtn.setAttribute('aria-label', 'Increase playback speed');
      incBtn.title = 'Increase speed';
      incBtn.textContent = '+';
      incBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onStepSpeed(1);
        this.revealControls();
      });

      pill.appendChild(decBtn);
      pill.appendChild(badgeBtn);
      pill.appendChild(incBtn);

      // Dropdown menu
      const menu = this.doc.createElement('div');
      menu.className = 'hs-menu';
      this.stopBubble(menu);
      menu.addEventListener('mouseenter', () => {
        this.isHovering = true;
        this.revealControls();
      });
      menu.addEventListener('mouseleave', () => {
        this.isHovering = false;
        this.scheduleAutoHide();
      });
      this.menuEl = menu;

      const header = this.doc.createElement('div');
      header.className = 'hs-menu-header';
      const title = this.doc.createElement('span');
      title.className = 'hs-menu-title';
      title.textContent = 'Playback Speed';
      const resetLink = this.doc.createElement('button');
      resetLink.type = 'button';
      resetLink.className = 'hs-reset-link';
      resetLink.textContent = 'Reset 1.0x';
      resetLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onResetSpeed();
      });
      header.appendChild(title);
      header.appendChild(resetLink);
      menu.appendChild(header);

      const presetsGrid = this.doc.createElement('div');
      presetsGrid.className = 'hs-presets';
      this.presetButtons.clear();

      SPEED_PRESETS.forEach((preset) => {
        const btn = this.doc.createElement('button');
        btn.type = 'button';
        btn.className = 'hs-preset-btn';
        btn.textContent = formatSpeed(preset);
        btn.dataset.speed = String(preset);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onSelectSpeed(preset);
          this.setMenuOpen(false);
        });
        presetsGrid.appendChild(btn);
        this.presetButtons.set(preset, btn);
      });
      menu.appendChild(presetsGrid);

      const sliderRow = this.doc.createElement('div');
      sliderRow.className = 'hs-slider-row';
      const sliderMeta = this.doc.createElement('div');
      sliderMeta.className = 'hs-slider-meta';
      const sliderLabel = this.doc.createElement('span');
      sliderLabel.textContent = 'Custom';
      const sliderVal = this.doc.createElement('span');
      sliderVal.className = 'hs-slider-val';
      sliderVal.textContent = formatSpeed(this.speed);
      this.sliderValEl = sliderVal;
      sliderMeta.appendChild(sliderLabel);
      sliderMeta.appendChild(sliderVal);

      const slider = this.doc.createElement('input');
      slider.type = 'range';
      slider.className = 'hs-slider';
      slider.min = String(MIN_SPEED);
      slider.max = String(MAX_SPEED);
      slider.step = '0.05';
      slider.value = String(this.speed);
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        const next = clampSpeed(parseFloat(slider.value));
        this.onSelectSpeed(next);
      });
      this.sliderEl = slider;

      sliderRow.appendChild(sliderMeta);
      sliderRow.appendChild(slider);
      menu.appendChild(sliderRow);

      corner.appendChild(pill);
      corner.appendChild(menu);

      // Center OSD Toast
      const toast = this.doc.createElement('div');
      toast.className = 'hs-toast';
      const toastIcon = this.doc.createElement('span');
      toastIcon.className = 'hs-toast-icon';
      toastIcon.textContent = '▶▶';
      const toastText = this.doc.createElement('span');
      toastText.textContent = formatSpeed(this.speed);
      toast.appendChild(toastIcon);
      toast.appendChild(toastText);
      this.toastEl = toast;
      this.toastTextEl = toastText;

      stage.appendChild(corner);
      stage.appendChild(toast);
      this.shadow.appendChild(stage);
    }

    attachGlobalListeners() {
      if (!this.doc) return;

      const onFullscreenChange = () => {
        this.mountHostToTargetParent();
        this.updatePosition();
        this.revealControls();
      };

      const onPointerMove = () => {
        if (this.video) {
          this.revealControls();
        }
      };

      const onOutsideClick = (e) => {
        if (!this.menuOpen) return;
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        if (this.host && (e.target === this.host || path.includes(this.host))) {
          return;
        }
        this.setMenuOpen(false);
      };

      const onResizeOrScroll = () => {
        this.schedulePositionUpdate();
      };

      const onKeyDown = (e) => {
        if (this.menuOpen && e.key === 'Escape') {
          this.setMenuOpen(false);
        }
      };

      this.doc.addEventListener('fullscreenchange', onFullscreenChange);
      this.doc.addEventListener('webkitfullscreenchange', onFullscreenChange);
      this.doc.addEventListener('mousemove', onPointerMove, { passive: true });
      this.doc.addEventListener('pointerdown', onOutsideClick, true);
      this.doc.addEventListener('keydown', onKeyDown, true);

      if (this.win && typeof this.win.addEventListener === 'function') {
        this.win.addEventListener('resize', onResizeOrScroll, { passive: true });
        this.win.addEventListener('scroll', onResizeOrScroll, { passive: true });
      }

      this.cleanupHandlers.push(() => {
        this.doc.removeEventListener('fullscreenchange', onFullscreenChange);
        this.doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        this.doc.removeEventListener('mousemove', onPointerMove);
        this.doc.removeEventListener('pointerdown', onOutsideClick, true);
        this.doc.removeEventListener('keydown', onKeyDown, true);
        if (this.win && typeof this.win.removeEventListener === 'function') {
          this.win.removeEventListener('resize', onResizeOrScroll);
          this.win.removeEventListener('scroll', onResizeOrScroll);
        }
      });
    }

    setVideo(video) {
      if (this.video === video) {
        this.updatePosition();
        return;
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      this.video = video || null;
      if (this.video && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.schedulePositionUpdate();
        });
        this.resizeObserver.observe(this.video);
      }
      this.mountHostToTargetParent();
      this.updatePosition();
      this.revealControls();
    }

    schedulePositionUpdate() {
      if (this.rafSyncId !== null || !this.win || !this.win.requestAnimationFrame) {
        this.updatePosition();
        return;
      }
      this.rafSyncId = this.win.requestAnimationFrame(() => {
        this.rafSyncId = null;
        this.updatePosition();
      });
    }

    updatePosition() {
      if (!this.host) return;
      this.mountHostToTargetParent();

      if (!this.video || !this.enabled || this.video.isConnected === false) {
        this.host.style.display = 'none';
        return;
      }

      const fsEl = this.getFullscreenElement();
      if (fsEl) {
        this.host.style.display = 'block';
        this.host.style.top = '0px';
        this.host.style.left = '0px';
        this.host.style.width = '100%';
        this.host.style.height = '100%';
        return;
      }

      if (typeof this.video.getBoundingClientRect !== 'function') {
        this.host.style.display = 'none';
        return;
      }

      const rect = this.video.getBoundingClientRect();
      if (!rect || rect.width < 220 || rect.height < 130) {
        this.host.style.display = 'none';
        return;
      }

      this.host.style.display = 'block';
      this.host.style.top = `${Math.round(rect.top)}px`;
      this.host.style.left = `${Math.round(rect.left)}px`;
      this.host.style.width = `${Math.round(rect.width)}px`;
      this.host.style.height = `${Math.round(rect.height)}px`;
    }

    setSettings(settings) {
      if (!settings) return;
      this.enabled = Boolean(settings.enabled);
      this.showOverlay = Boolean(settings.showOverlay);
      this.autoHideOverlay = Boolean(settings.autoHideOverlay);
      this.overlayCorner = settings.overlayCorner || 'top-right';
      this.showToastEnabled = Boolean(settings.showToast);
      this.speed = clampSpeed(settings.speed);
      this.renderState();
      this.updatePosition();
      if (!this.autoHideOverlay) {
        this.revealControls();
      } else {
        this.scheduleAutoHide();
      }
    }

    setSpeed(nextSpeed, options = {}) {
      this.speed = clampSpeed(nextSpeed);
      this.renderState();
      if (options.toast && this.showToastEnabled && this.enabled && this.video) {
        this.showToast(this.speed);
      }
    }

    toggleMenu() {
      this.setMenuOpen(!this.menuOpen);
    }

    setMenuOpen(open) {
      this.menuOpen = Boolean(open);
      if (this.menuEl) {
        if (this.menuOpen) {
          this.menuEl.classList.add('is-open');
          this.revealControls();
        } else {
          this.menuEl.classList.remove('is-open');
          this.scheduleAutoHide();
        }
      }
    }

    revealControls() {
      if (!this.cornerEl) return;
      this.cornerEl.classList.remove('is-hidden');
      this.scheduleAutoHide();
    }

    scheduleAutoHide() {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      if (!this.cornerEl) return;
      if (!this.autoHideOverlay || this.menuOpen || this.isHovering) {
        return;
      }
      this.hideTimer = setTimeout(() => {
        if (!this.destroyed && this.cornerEl && this.autoHideOverlay && !this.menuOpen && !this.isHovering) {
          this.cornerEl.classList.add('is-hidden');
        }
      }, 2600);
    }

    showToast(speed) {
      if (!this.toastEl || !this.toastTextEl || !this.video) return;
      this.updatePosition();
      this.toastTextEl.textContent = formatSpeed(speed);
      this.toastEl.classList.add('is-visible');
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
      this.toastTimer = setTimeout(() => {
        if (!this.destroyed && this.toastEl) {
          this.toastEl.classList.remove('is-visible');
        }
      }, 950);
    }

    renderState() {
      const label = formatSpeed(this.speed);
      if (this.cornerEl) {
        this.cornerEl.setAttribute('data-corner', this.overlayCorner);
        this.cornerEl.style.display = this.showOverlay && this.enabled ? 'flex' : 'none';
      }
      if (this.badgeBtn) {
        this.badgeBtn.textContent = label;
        if (Math.abs(this.speed - DEFAULT_SPEED) > 0.001) {
          this.badgeBtn.classList.add('is-modified');
        } else {
          this.badgeBtn.classList.remove('is-modified');
        }
      }
      if (this.sliderEl) {
        this.sliderEl.value = String(this.speed);
      }
      if (this.sliderValEl) {
        this.sliderValEl.textContent = label;
      }
      for (const [preset, btn] of this.presetButtons.entries()) {
        if (Math.abs(preset - this.speed) <= 0.001) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      }
    }
  }

  return { PlayerUI, HOST_ID };
});
