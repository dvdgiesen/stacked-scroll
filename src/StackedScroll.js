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
      compactClassName: options.compactClassName ?? 'stacked-scroll-compact'
    };

    this.sections = [];
    this.triggers = [];
    this.spacer = null;
    this.resizeTimer = null;

    this._onLoad = this._handleLoad.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onOrientationChange = this._handleOrientationChange.bind(this);
    this._onVisualViewportResize = this._handleVisualViewportResize.bind(this);

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

    // Apply compact-state class before measuring so pin ranges are calculated
    // with the correct (possibly header-less) section heights.
    this._updateCompactState();

    this._createTriggers();
    this._updateSpacer();
    this._attachListeners();

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

    window.scrollTo({
      top: Math.max(0, docTop - headerOffset),
      behavior: this._prefersReducedMotion() ? 'auto' : (options.behavior ?? this.config.scrollBehavior)
    });
  }

  /**
   * Refresh all cached ScrollTrigger measurements and spacer sizing.
   */
  refresh() {
    this._updateCompactState();
    this._updateSpacer();
    ScrollTrigger.refresh();
  }

  /**
   * Tear down all created ScrollTriggers, listeners, and the auto-created spacer.
   */
  destroy() {
    window.removeEventListener('load', this._onLoad);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onOrientationChange);

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onVisualViewportResize);
    }

    clearTimeout(this.resizeTimer);

    this.triggers.forEach((trigger) => trigger.kill());
    this.triggers = [];

    if (this.spacer && !this.config.spacerSelector) {
      this.spacer.remove();
      this.spacer = null;
    }

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

  _createTriggers() {
    this.sections.forEach((section) => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: () => this._computeStart(section),
        end: () => this._computeEnd(section),
        pin: true,
        pinSpacing: false
      });
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
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return Math.min(nextTop, Math.max(maxScroll - 1, 0));
  }

  _cumulativeHeightTo(idx) {
    let sum = 0;
    for (let i = 0; i <= idx; i++) {
      sum += this.sections[i].offsetHeight;
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

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onVisualViewportResize);
    }
  }

  _handleLoad() {
    this._updateCompactState();
    this._updateSpacer();
    ScrollTrigger.refresh();
  }

  _handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this._updateCompactState();
      this._updateSpacer();
      ScrollTrigger.refresh();
    }, this.config.resizeDebounceMs);
  }

  _handleOrientationChange() {
    // visualViewport may not report the final size immediately after a
    // device rotation; defer the recalculation so the spacer stays correct.
    setTimeout(() => {
      this._updateCompactState();
      this._updateSpacer();
      ScrollTrigger.refresh();
    }, 100);
  }

  _handleVisualViewportResize() {
    // URL bar show/hide on mobile changes the visual viewport without
    // necessarily firing a window resize event. Debounce the same way.
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
    // Sum natural (unpinned) heights of every section BEFORE the target.
    let cumulativeHeight = 0;
    for (const s of this.sections) {
      if (s === section) break;
      cumulativeHeight += s.offsetHeight;
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
