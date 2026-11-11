import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

/**
 * StackedScroll — a hardened, framework-agnostic library for the
 * "stacked-pages" scroll effect built on GSAP ScrollTrigger.
 *
 * Extracted from rotyounges.com, with the fragile edge cases
 * (deep-link offset under pinned sections, short last panel flush-top,
 * previous panel release on the final transition) generalized into a
 * reusable module.
 */
export class StackedScroll {
  /**
   * @param {Object} options
   * @param {string | HTMLElement | NodeList | HTMLElement[]} [options.sections='.panel']
   * @param {string} [options.headerSelector='.header']
   * @param {string} [options.mainSelector='.main']
   * @param {string | null} [options.spacerSelector=null]
   * @param {number} [options.resizeDebounceMs=200]
   * @param {string} [options.scrollBehavior='smooth']
   * @param {number | null} [options.hideHeadersBelow=null]
   *        Viewport height (px) below which section headers are hidden/collapsed.
   * @param {string} [options.compactClassName='stacked-scroll-compact']
   *        Class added to <html> when the viewport is below hideHeadersBelow.
   * @param {boolean} [options.protectFullscreen=true]
   *        Prevent ScrollTrigger revert/refresh from detaching pinned DOM nodes
   *        while native fullscreen (or manual setFullscreenGuard) is active.
   */
  constructor(options = {}) {
    this.config = {
      sections: options.sections ?? '.panel',
      headerSelector: options.headerSelector ?? '.header',
      mainSelector: options.mainSelector ?? '.main',
      spacerSelector: options.spacerSelector ?? null,
      resizeDebounceMs: options.resizeDebounceMs ?? 200,
      scrollBehavior: options.scrollBehavior ?? 'smooth',
      hideHeadersBelow: options.hideHeadersBelow ?? null,
      compactClassName: options.compactClassName ?? 'stacked-scroll-compact',
      protectFullscreen: options.protectFullscreen ?? true
    };

    this.sections = [];
    this.triggers = [];
    this.buffers = new Map();
    this.spacer = null;
    this.resizeTimer = null;

    this._fullscreenGuard = {
      manualActive: false,
      wasActive: false,
      restoreW: 0,
      restoreH: 0,
      pendingRestore: false,
      restoreTimer: null,
      catchupTimer: null
    };
    this._lastViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;

    this._onLoad = this._handleLoad.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onOrientationChange = this._handleOrientationChange.bind(this);
    this._onVisualViewportResize = this._handleVisualViewportResize.bind(this);
    this._onFullscreenChange = this._handleFullscreenChange.bind(this);

    gsap.registerPlugin(ScrollTrigger);
  }

  /**
   * Set up ScrollTriggers, spacer, and listeners.
   * @returns {StackedScroll}
   */
  init() {
    this.sections = this._resolveSections(this.config.sections);

    if (this.sections.length === 0) {
      console.warn('StackedScroll: no sections found for selector', this.config.sections);
      return this;
    }

    this._ensureSpacer();

    // Apply compact-state class, settle buffers, and spacer sizing BEFORE
    // creating triggers so initial pin `start`/`end` calculations see the
    // true section heights and document scrollHeight.
    this._updateCompactState();
    this._insertBuffers();
    this._updateSpacer();
    this._createTriggers();
    this._attachListeners();

    this._lastViewportWidth = window.innerWidth;

    return this;
  }

  /**
   * Scroll to a section or to a specific element within a section.
   * @param {string | HTMLElement} target — element id string, or element
   * @param {Object} [options]
   * @param {string | HTMLElement} [options.offsetElement] — element to align to; defaults to the section's `.main`
   * @param {string} [options.behavior] — 'smooth' | 'auto'; falls back to config.scrollBehavior
   */
  scrollTo(target, options = {}) {
    const section = this._resolveTargetSection(target);
    if (!section) {
      console.warn('StackedScroll.scrollTo: target not found', target);
      return;
    }

    const offsetElement = this._resolveOffsetElement(section, options.offsetElement);
    if (!offsetElement) {
      console.warn('StackedScroll.scrollTo: no offset element found for target', target);
      return;
    }

    const docTop = this._computeDocTop(section, offsetElement);
    const headerOffset = this._computeHeaderOffset(section);

    let targetY = Math.max(0, docTop - headerOffset);

    // Short panels start pinning at the top of their natural range. Landing
    // exactly on that boundary can leave the element static in some browsers,
    // so nudge just inside the pin range to guarantee an active pin.
    if (section.offsetHeight < this._getViewportHeight()) {
      targetY += 1;
    }

    window.scrollTo({
      top: targetY,
      behavior: this._prefersReducedMotion() ? 'auto' : (options.behavior ?? this.config.scrollBehavior)
    });
  }

  /**
   * Refresh all cached ScrollTrigger measurements, settle buffers, and spacer sizing.
   * No-ops while fullscreen protection is active so pinned DOM nodes (and child
   * iframes/videos) are never detached during fullscreen playback.
   */
  refresh() {
    if (this._isFullscreenProtected()) return;
    this._insertBuffers();
    this._updateCompactState();
    this._updateSpacer();
    ScrollTrigger.refresh();
  }

  /**
   * Manually engage or release the fullscreen guard (useful for CSS pseudo-fullscreen
   * fallbacks on browsers like iOS Safari where `document.fullscreenElement` is not set).
   * @param {boolean} active
   */
  setFullscreenGuard(active) {
    const next = Boolean(active);
    if (next && !this._isFullscreenProtected()) {
      this._fullscreenGuard.restoreW = window.innerWidth;
      this._fullscreenGuard.restoreH = window.innerHeight;
    }
    this._fullscreenGuard.manualActive = next;
    this._syncFullscreenGuardState();
  }

  /**
   * Tear down all created ScrollTriggers, listeners, and the auto-created spacer.
   */
  destroy() {
    window.removeEventListener('load', this._onLoad);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onOrientationChange);
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onVisualViewportResize);
    }

    clearTimeout(this.resizeTimer);
    clearTimeout(this._fullscreenGuard.restoreTimer);
    clearTimeout(this._fullscreenGuard.catchupTimer);
    this._fullscreenGuard.manualActive = false;
    this._fullscreenGuard.wasActive = false;

    this.triggers.forEach((trigger) => trigger.kill());
    this.triggers = [];

    if (this.spacer && !this.config.spacerSelector) {
      this.spacer.remove();
      this.spacer = null;
    }

    this._removeBuffers();

    document.documentElement.classList.remove(this.config.compactClassName);

    this.sections = [];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────────

  _resolveSections(input) {
    if (typeof input === 'string') {
      return gsap.utils.toArray(input);
    }
    if (input instanceof NodeList || Array.isArray(input)) {
      return Array.from(input);
    }
    if (input instanceof HTMLElement) {
      return [input];
    }
    return [];
  }

  _ensureSpacer() {
    if (this.config.spacerSelector) {
      this.spacer = document.querySelector(this.config.spacerSelector);
      return;
    }

    this.spacer = document.createElement('div');
    this.spacer.id = 'stacked-scroll-end-spacer';
    this.spacer.setAttribute('aria-hidden', 'true');
    this.spacer.style.pointerEvents = 'none';
    this.spacer.style.visibility = 'hidden';
    document.body.appendChild(this.spacer);
  }

  /**
   * Insert or update invisible settle buffers between any pair of consecutive
   * short sections (shorter than the viewport). Short panels back-to-back don't
   * provide enough natural scroll distance for the previous pin to release
   * before the next one engages, so we synthesise the missing scroll room.
   * Existing buffer DOM nodes are reused across resizes to avoid churn.
   */
  _insertBuffers() {
    const viewportHeight = this._getViewportHeight();

    for (let i = 0; i < this.sections.length - 1; i++) {
      const section = this.sections[i];
      const nextSection = this.sections[i + 1];
      if (!section || !nextSection) continue;

      const sectionShort = section.offsetHeight <= viewportHeight;
      const nextShort = nextSection.offsetHeight <= viewportHeight;

      if (sectionShort && nextShort) {
        let buffer = this.buffers.get(i);
        if (!buffer) {
          buffer = document.createElement('div');
          buffer.className = 'stacked-scroll-buffer';
          buffer.setAttribute('aria-hidden', 'true');
          buffer.style.pointerEvents = 'none';
          buffer.style.visibility = 'hidden';
          this.buffers.set(i, buffer);
        }
        // Insert the buffer AFTER the current section's outermost wrapper. At
        // init the section is not yet pinned, so this is the section itself.
        // Once ScrollTrigger wraps it in a pin-spacer, we insert after that
        // spacer so the buffer still contributes to document flow.
        const wrapper = section.closest('.pin-spacer') || section;
        if (buffer.previousElementSibling !== wrapper) {
          wrapper.after(buffer);
        }
        buffer.style.height = `${Math.max(0, viewportHeight - section.offsetHeight)}px`;
      } else if (this.buffers.has(i)) {
        this.buffers.get(i).remove();
        this.buffers.delete(i);
      }
    }
  }

  _removeBuffers() {
    this.buffers.forEach((buffer) => buffer.remove());
    this.buffers.clear();
  }

  _createTriggers() {
    this.sections.forEach((section) => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: () => this._computeStart(section),
        end: () => this._computeEnd(section),
        pin: true,
        pinSpacing: false
      });

      // Wrap revert() and refresh() on every trigger instance so that while
      // fullscreen protection is active, GSAP (including its internal
      // matchMedia("(orientation: portrait)") listener on device rotation)
      // cannot re-parent the pinned element and cancel fullscreen or reload iframes.
      const self = this;
      const origRevert = trigger.revert;
      const origRefresh = trigger.refresh;
      trigger.revert = function () {
        if (self._isFullscreenProtected()) return;
        return origRevert.apply(this, arguments);
      };
      trigger.refresh = function () {
        if (self._isFullscreenProtected()) return;
        return origRefresh.apply(this, arguments);
      };

      this.triggers.push(trigger);
    });
  }

  _computeStart(section) {
    // Short panels pin at the top immediately; tall panels pin only after
    // their own content has been fully scrolled through.
    return section.offsetHeight < this._getViewportHeight() ? 'top top' : 'bottom bottom';
  }

  _computeEnd(section) {
    const idx = this.sections.indexOf(section);

    // Last section: pin through the end of the document so it can reach
    // flush-top when shorter than the viewport.
    if (idx === this.sections.length - 1) {
      return 'max';
    }

    // Handoff point: the top edge of the next section, measured in natural
    // (unpinned) document coordinates.
    const nextTop = this._cumulativeHeightTo(idx);

    // GSAP only releases a pin once scroll has passed `end`. If `end` lands on
    // or past the document's maximum scroll position (most commonly when the
    // last section is shorter than the viewport), the browser can never scroll
    // past it and the previous panel stays `position: fixed` forever, covering
    // the final section. Clamp the end just before max scroll so the handoff
    // can always complete.
    const maxScroll = document.documentElement.scrollHeight - this._getViewportHeight();
    return Math.min(nextTop, Math.max(maxScroll - 1, 0));
  }

  _cumulativeHeightTo(idx) {
    let sum = 0;
    for (let i = 0; i <= idx; i++) {
      sum += this.sections[i].offsetHeight;
      // Include any synthetic settle buffer inserted after this section
      // (present when this section and the next are both short).
      const buffer = this.buffers.get(i);
      if (buffer) sum += buffer.offsetHeight;
    }
    return sum;
  }

  _updateSpacer() {
    if (!this.spacer || this.sections.length === 0) return;

    const lastSection = this.sections[this.sections.length - 1];
    const shortfall = this._getViewportHeight() - lastSection.offsetHeight;

    this.spacer.style.height = (shortfall > 0 ? shortfall : 0) + 'px';
  }

  _updateCompactState() {
    if (!this.config.hideHeadersBelow) return;

    const isCompact = this._getViewportHeight() < this.config.hideHeadersBelow;
    document.documentElement.classList.toggle(this.config.compactClassName, isCompact);
  }

  _attachListeners() {
    window.addEventListener('load', this._onLoad);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onOrientationChange);
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onVisualViewportResize);
    }
  }

  _isFullscreenProtected() {
    if (!this.config.protectFullscreen) return false;
    const nativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    return nativeFs || this._fullscreenGuard.manualActive;
  }

  _handleFullscreenChange() {
    this._syncFullscreenGuardState();
  }

  _syncFullscreenGuardState() {
    const g = this._fullscreenGuard;
    const active = this._isFullscreenProtected();

    if (active && !g.wasActive) {
      g.pendingRestore = false;
      clearTimeout(g.restoreTimer);
      clearTimeout(g.catchupTimer);
      if (!g.restoreW || !g.restoreH) {
        g.restoreW = window.innerWidth;
        g.restoreH = window.innerHeight;
      }
    } else if (!active && g.wasActive) {
      g.pendingRestore = true;
      clearTimeout(g.restoreTimer);
      g.restoreTimer = setTimeout(() => {
        g.pendingRestore = false;
      }, 1500);

      // If the device rotated or the window changed size while fullscreen
      // had frozen the triggers, run one catch-up refresh after fullscreen settles.
      clearTimeout(g.catchupTimer);
      g.catchupTimer = setTimeout(() => {
        if (this._isFullscreenProtected()) return;
        if (window.innerWidth !== g.restoreW || window.innerHeight !== g.restoreH) {
          this.refresh();
        }
        g.restoreW = 0;
        g.restoreH = 0;
      }, 400);
    }

    g.wasActive = active;
  }

  _shouldSkipResizeRefresh() {
    if (this._isFullscreenProtected()) return true;
    const g = this._fullscreenGuard;
    if (g.pendingRestore) {
      g.pendingRestore = false;
      return window.innerWidth === g.restoreW && window.innerHeight === g.restoreH;
    }
    return false;
  }

  _handleLoad() {
    this.refresh();
  }

  _handleResize() {
    if (!this._isFullscreenProtected() && !this._fullscreenGuard.pendingRestore) {
      this._fullscreenGuard.restoreW = window.innerWidth;
      this._fullscreenGuard.restoreH = window.innerHeight;
    }
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this._shouldSkipResizeRefresh()) return;
      this._lastViewportWidth = window.innerWidth;
      this.refresh();
    }, this.config.resizeDebounceMs);
  }

  _handleOrientationChange() {
    // visualViewport may not report the final size immediately after a
    // device rotation; defer the recalculation so the spacer stays correct.
    setTimeout(() => {
      if (this._shouldSkipResizeRefresh()) return;
      this._lastViewportWidth = window.innerWidth;
      this.refresh();
    }, 100);
  }

  _handleVisualViewportResize() {
    if (this._shouldSkipResizeRefresh()) return;
    // On mobile, scrolling collapses/expands the URL bar, which fires
    // visualViewport.resize with only a small vertical height change and
    // identical innerWidth. Update the non-destructive spacer/compact state
    // without forcing a full DOM-detaching ScrollTrigger.refresh() unless width changed.
    if (window.innerWidth === this._lastViewportWidth) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        if (this._shouldSkipResizeRefresh()) return;
        this._updateCompactState();
        this._updateSpacer();
      }, this.config.resizeDebounceMs);
      return;
    }
    this._handleResize();
  }

  _getViewportHeight() {
    // visualViewport gives the stable viewport size on mobile even when the
    // URL bar collapses/expands. Fallback to innerHeight for older browsers.
    return window.visualViewport?.height ?? window.innerHeight;
  }

  _prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  _resolveTargetSection(target) {
    if (typeof target === 'string') {
      return document.getElementById(target);
    }
    if (target instanceof HTMLElement) {
      if (this.sections.includes(target)) return target;
      return target.closest(this._sectionsSelectorString());
    }
    return null;
  }

  _sectionsSelectorString() {
    return typeof this.config.sections === 'string'
      ? this.config.sections
      : '.stacked-scroll-section';
  }

  _resolveOffsetElement(section, override) {
    if (override) {
      return typeof override === 'string'
        ? section.querySelector(override)
        : override;
    }
    return section.querySelector(this.config.mainSelector);
  }

  _computeDocTop(section, offsetElement) {
    // Sum natural (unpinned) heights of every section BEFORE the target,
    // including any synthetic settle buffers inserted between them.
    let cumulativeHeight = 0;
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i];
      if (s === section) break;
      cumulativeHeight += s.offsetHeight;
      const buffer = this.buffers.get(i);
      if (buffer) cumulativeHeight += buffer.offsetHeight;
    }

    // The target's position within its own section, measured in the same
    // viewport coordinate space so it stays correct even when the section
    // or an ancestor is currently `position: fixed`.
    const offsetWithinSection =
      offsetElement.getBoundingClientRect().top - section.getBoundingClientRect().top;

    return cumulativeHeight + offsetWithinSection;
  }

  _computeHeaderOffset(section) {
    const targetHeader = section.querySelector(this.config.headerSelector);
    const firstHeader = this.sections[0]?.querySelector(this.config.headerSelector);
    return targetHeader?.offsetHeight ?? firstHeader?.offsetHeight ?? 0;
  }
}
