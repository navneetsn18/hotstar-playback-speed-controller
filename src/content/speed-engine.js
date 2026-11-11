(function (root, factory) {
  const shared =
    typeof module === 'object' && module.exports
      ? require('../shared/constants')
      : root.HotstarSpeedShared;
  const api = factory(shared);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HotstarSpeedEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared) {
  'use strict';

  const { clampSpeed, DEFAULT_SPEED } = Shared;

  class SpeedEngine {
    /**
     * @param {object} [options]
     * @param {Document} [options.document]
     * @param {number} [options.speed]
     * @param {boolean} [options.enabled]
     * @param {boolean} [options.preservesPitch]
     * @param {(video: HTMLVideoElement | null) => void} [options.onPrimaryVideoChange]
     * @param {(speed: number, video: HTMLVideoElement | null) => void} [options.onSpeedEnforced]
     */
    constructor(options = {}) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.targetSpeed = clampSpeed(
        options.speed !== undefined ? options.speed : DEFAULT_SPEED
      );
      this.enabled = options.enabled !== undefined ? Boolean(options.enabled) : true;
      this.preservesPitch =
        options.preservesPitch !== undefined ? Boolean(options.preservesPitch) : true;

      this.onPrimaryVideoChange =
        typeof options.onPrimaryVideoChange === 'function'
          ? options.onPrimaryVideoChange
          : null;
      this.onSpeedEnforced =
        typeof options.onSpeedEnforced === 'function' ? options.onSpeedEnforced : null;

      this.trackedVideos = new Map(); // video -> { cleanup: fn, guardTimestamps: number[] }
      this.applyingVideos = new WeakSet();
      this.primaryVideo = null;
      this.observer = null;
      this.heartbeatId = null;
      this.docListenersCleanup = null;
      this.destroyed = false;
    }

    start() {
      if (this.destroyed || !this.doc) return;
      this.scanForVideos();
      this.attachDocumentListeners();
      this.startMutationObserver();
      this.startHeartbeat();
    }

    destroy() {
      this.destroyed = true;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.heartbeatId !== null) {
        clearInterval(this.heartbeatId);
        this.heartbeatId = null;
      }
      if (this.docListenersCleanup) {
        this.docListenersCleanup();
        this.docListenersCleanup = null;
      }
      for (const [video, meta] of this.trackedVideos.entries()) {
        meta.cleanup();
        this.trackedVideos.delete(video);
      }
      this.primaryVideo = null;
    }

    /**
     * Update target speed and immediately apply to active videos.
     * @param {number} nextSpeed
     * @returns {number}
     */
    setTargetSpeed(nextSpeed) {
      this.targetSpeed = clampSpeed(nextSpeed);
      if (this.enabled) {
        this.applyToAll();
      }
      return this.targetSpeed;
    }

    /**
     * Enable or disable playback speed enforcement.
     * @param {boolean} nextEnabled
     */
    setEnabled(nextEnabled) {
      const flag = Boolean(nextEnabled);
      if (this.enabled === flag) return;
      this.enabled = flag;
      if (this.enabled) {
        this.applyToAll();
      } else {
        for (const video of this.trackedVideos.keys()) {
          this.writeRate(video, DEFAULT_SPEED);
        }
      }
    }

    /**
     * Update preservesPitch setting across tracked videos.
     * @param {boolean} nextPreserve
     */
    setPreservesPitch(nextPreserve) {
      this.preservesPitch = Boolean(nextPreserve);
      for (const video of this.trackedVideos.keys()) {
        this.applyPitchSetting(video);
      }
    }

    applyPitchSetting(video) {
      if (!video) return;
      try {
        if ('preservesPitch' in video) {
          video.preservesPitch = this.preservesPitch;
        }
        if ('webkitPreservesPitch' in video) {
          video.webkitPreservesPitch = this.preservesPitch;
        }
        if ('mozPreservesPitch' in video) {
          video.mozPreservesPitch = this.preservesPitch;
        }
      } catch (_err) {
        // Ignore read-only properties in restricted environments
      }
    }

    writeRate(video, rate) {
      if (!video) return false;
      const cleanRate = clampSpeed(rate);
      this.applyPitchSetting(video);

      if (Math.abs((video.playbackRate || DEFAULT_SPEED) - cleanRate) <= 0.001) {
        return false;
      }

      this.applyingVideos.add(video);
      try {
        video.playbackRate = cleanRate;
        if (typeof video.defaultPlaybackRate === 'number') {
          video.defaultPlaybackRate = cleanRate;
        }
      } catch (_err) {
        // Ignore browser media errors if element is not ready
      } finally {
        this.applyingVideos.delete(video);
      }
      return true;
    }

    applyToVideo(video) {
      if (!video || !this.enabled) return;
      const changed = this.writeRate(video, this.targetSpeed);
      if (changed && this.onSpeedEnforced && video === this.primaryVideo) {
        this.onSpeedEnforced(this.targetSpeed, video);
      }
    }

    applyToAll() {
      this.pruneDisconnectedVideos();
      this.updatePrimaryVideo();
      for (const video of this.trackedVideos.keys()) {
        this.applyToVideo(video);
      }
    }

    /**
     * Guard against infinite ratechange loops if a platform/browser clamps or rejects a rate.
     * @param {HTMLVideoElement} video
     * @returns {boolean}
     */
    canEnforceRate(video) {
      const meta = this.trackedVideos.get(video);
      if (!meta) return false;
      const now = Date.now();
      meta.guardTimestamps = meta.guardTimestamps.filter((ts) => now - ts < 300);
      if (meta.guardTimestamps.length >= 6) {
        return false;
      }
      meta.guardTimestamps.push(now);
      return true;
    }

    trackVideo(video) {
      if (!video || this.trackedVideos.has(video) || this.destroyed) return;

      const onRateChange = () => {
        if (this.applyingVideos.has(video) || !this.enabled) return;
        const current = Number(video.playbackRate);
        if (Math.abs(current - this.targetSpeed) > 0.001) {
          if (this.canEnforceRate(video)) {
            this.writeRate(video, this.targetSpeed);
            // Some players reset playbackRate asynchronously right after emitting ratechange
            setTimeout(() => {
              if (!this.destroyed && this.enabled && this.trackedVideos.has(video)) {
                if (Math.abs(Number(video.playbackRate) - this.targetSpeed) > 0.001) {
                  this.writeRate(video, this.targetSpeed);
                }
              }
            }, 50);
          }
        }
      };

      const onPlaybackEvent = () => {
        this.updatePrimaryVideo();
        if (this.enabled) {
          this.applyToVideo(video);
        }
      };

      const events = ['ratechange', 'play', 'playing', 'loadedmetadata', 'canplay'];
      events.forEach((evt) => {
        const handler = evt === 'ratechange' ? onRateChange : onPlaybackEvent;
        video.addEventListener(evt, handler);
      });

      const cleanup = () => {
        events.forEach((evt) => {
          const handler = evt === 'ratechange' ? onRateChange : onPlaybackEvent;
          video.removeEventListener(evt, handler);
        });
      };

      this.trackedVideos.set(video, { cleanup, guardTimestamps: [] });
      this.updatePrimaryVideo();
      if (this.enabled) {
        this.applyToVideo(video);
      }
    }

    untrackVideo(video) {
      const meta = this.trackedVideos.get(video);
      if (!meta) return;
      meta.cleanup();
      this.trackedVideos.delete(video);
      this.updatePrimaryVideo();
    }

    pruneDisconnectedVideos() {
      for (const video of Array.from(this.trackedVideos.keys())) {
        if (video.isConnected === false) {
          this.untrackVideo(video);
        }
      }
    }

    scanForVideos() {
      if (!this.doc || typeof this.doc.querySelectorAll !== 'function') return;
      const videos = this.doc.querySelectorAll('video');
      videos.forEach((video) => this.trackVideo(video));
      this.pruneDisconnectedVideos();
      this.updatePrimaryVideo();
    }

    scoreVideo(video) {
      if (!video || video.isConnected === false) return -Infinity;
      let score = 0;

      const fsEl = this.doc && (this.doc.fullscreenElement || this.doc.webkitFullscreenElement);
      if (fsEl && (fsEl === video || (typeof fsEl.contains === 'function' && fsEl.contains(video)))) {
        score += 10000;
      }

      if (!video.paused && !video.ended) {
        score += 500;
      }
      if (Number(video.readyState) >= 2) {
        score += 200;
      } else if (Number(video.readyState) >= 1) {
        score += 50;
      }
      if (!video.muted) {
        score += 100;
      }

      let width = Number(video.clientWidth) || 0;
      let height = Number(video.clientHeight) || 0;
      if ((!width || !height) && typeof video.getBoundingClientRect === 'function') {
        const rect = video.getBoundingClientRect();
        width = rect ? Number(rect.width) || 0 : 0;
        height = rect ? Number(rect.height) || 0 : 0;
      }

      if (width === 0 || height === 0) {
        score -= 500;
      } else if (width >= 200 && height >= 120) {
        score += Math.min(400, Math.round((width * height) / 2500));
      }

      return score;
    }

    getPrimaryVideo() {
      this.pruneDisconnectedVideos();
      let best = null;
      let bestScore = -Infinity;

      for (const video of this.trackedVideos.keys()) {
        const s = this.scoreVideo(video);
        if (s > bestScore) {
          bestScore = s;
          best = video;
        }
      }
      return best;
    }

    updatePrimaryVideo() {
      const nextPrimary = this.getPrimaryVideo();
      if (nextPrimary !== this.primaryVideo) {
        this.primaryVideo = nextPrimary;
        if (this.onPrimaryVideoChange) {
          this.onPrimaryVideoChange(this.primaryVideo);
        }
      }
      return this.primaryVideo;
    }

    attachDocumentListeners() {
      if (!this.doc || typeof this.doc.addEventListener !== 'function') return;

      const onCaptureMedia = (event) => {
        const target = event && event.target;
        if (target && target.tagName && target.tagName.toUpperCase() === 'VIDEO') {
          if (!this.trackedVideos.has(target)) {
            this.trackVideo(target);
          } else {
            this.updatePrimaryVideo();
          }
        }
      };

      const captureEvents = ['play', 'playing', 'loadedmetadata', 'ratechange'];
      captureEvents.forEach((evt) => {
        this.doc.addEventListener(evt, onCaptureMedia, true);
      });

      this.docListenersCleanup = () => {
        captureEvents.forEach((evt) => {
          this.doc.removeEventListener(evt, onCaptureMedia, true);
        });
      };
    }

    startMutationObserver() {
      if (typeof MutationObserver === 'undefined' || !this.doc) return;
      const rootNode = this.doc.documentElement || this.doc.body;
      if (!rootNode) return;

      this.observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node && node.nodeType === 1) {
                if (
                  (node.tagName && node.tagName.toUpperCase() === 'VIDEO') ||
                  (typeof node.querySelector === 'function' && node.querySelector('video'))
                ) {
                  shouldScan = true;
                  break;
                }
              }
            }
          }
          if (!shouldScan && mutation.removedNodes && mutation.removedNodes.length > 0) {
            for (const node of mutation.removedNodes) {
              if (node && node.nodeType === 1) {
                if (
                  (node.tagName && node.tagName.toUpperCase() === 'VIDEO') ||
                  (typeof node.querySelector === 'function' && node.querySelector('video'))
                ) {
                  shouldScan = true;
                  break;
                }
              }
            }
          }
          if (shouldScan) break;
        }
        if (shouldScan) {
          this.scanForVideos();
        }
      });

      this.observer.observe(rootNode, { childList: true, subtree: true });
    }

    startHeartbeat() {
      this.heartbeatId = setInterval(() => {
        if (this.destroyed) return;
        this.scanForVideos();
        if (this.enabled) {
          for (const video of this.trackedVideos.keys()) {
            if (!video.paused && !video.ended) {
              this.applyToVideo(video);
            }
          }
        }
      }, 1000);
    }
  }

  return { SpeedEngine };
});
