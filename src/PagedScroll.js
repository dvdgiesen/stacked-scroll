import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * PagedScroll — a hardened, framework-agnostic library for the
 * "newspaper page-turn" scroll effect built on GSAP ScrollTrigger.
 *
 * Extracted from the RotYounges website, with the fragile edge cases
 * (short last panel flush-top, deep-link offset under pinned sections)
 * generalized into a reusable module.
 */
export class PagedScroll {
  /**
   * @param {Object} options
   * @param {string | HTMLElement | NodeList | HTMLElement[]} [options.sections='.panel']
   * @param {string} [options.headerSelector='.header']
   * @param {string} [options.mainSelector='.main']
   * @param {string | null} [options.spacerSelector=null]
   * @param {number} [options.resizeDebounceMs=200]
   * @param {string} [options.scrollBehavior='smooth']
   */
  constructor(options = {}) {
    this.config = {
      sections: options.sections ?? '.panel',
      headerSelector: options.headerSelector ?? '.header',
      mainSelector: options.mainSelector ?? '.main',
      spacerSelector: options.spacerSelector ?? null,
      resizeDebounceMs: options.resizeDebounceMs ?? 200,
      scrollBehavior: options.scrollBehavior ?? 'smooth'
    };

    this.sections = [];
    this.triggers = [];
    this.spacer = null;
    this.resizeTimer = null;

    this._onLoad = this._handleLoad.bind(this);
    this._onResize = this._handleResize.bind(this);

    gsap.registerPlugin(ScrollTrigger);
  }

  /**
   * Set up ScrollTriggers, spacer, and listeners.
   * @returns {PagedScroll}
   */
  init() {
    this.sections = this._resolveSections(this.config.sections);

    if (this.sections.length === 0) {
      console.warn('PagedScroll: no sections found for selector', this.config.sections);
      return this;
    }

    this._ensureSpacer();
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
      console.warn('PagedScroll.scrollTo: target not found', target);
      return;
    }

    const offsetElement = this._resolveOffsetElement(section, options.offsetElement);
    if (!offsetElement) {
      console.warn('PagedScroll.scrollTo: no offset element found for target', target);
      return;
    }

    const docTop = this._computeDocTop(section, offsetElement);
    const headerOffset = this._computeHeaderOffset(section);

    window.scrollTo({
      top: Math.max(0, docTop - headerOffset),
      behavior: options.behavior ?? this.config.scrollBehavior
    });
  }

  /**
   * Refresh all cached ScrollTrigger measurements and spacer sizing.
   */
  refresh() {
    this._updateSpacer();
    ScrollTrigger.refresh();
  }

  /**
   * Tear down all created ScrollTriggers, listeners, and the auto-created spacer.
   */
  destroy() {
    window.removeEventListener('load', this._onLoad);
    window.removeEventListener('resize', this._onResize);
    clearTimeout(this.resizeTimer);

    this.triggers.forEach((trigger) => trigger.kill());
    this.triggers = [];

    if (this.spacer && !this.config.spacerSelector) {
      this.spacer.remove();
      this.spacer = null;
    }

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
    this.spacer.id = 'paged-scroll-end-spacer';
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
        pin: true,
        pinSpacing: false
      });
      this.triggers.push(trigger);
    });
  }

  _computeStart(section) {
    // Short panels pin at the top immediately; tall panels pin only after
    // their own content has been fully scrolled through.
    return section.offsetHeight < window.innerHeight ? 'top top' : 'bottom bottom';
  }

  _updateSpacer() {
    if (!this.spacer || this.sections.length === 0) return;

    const lastSection = this.sections[this.sections.length - 1];
    const shortfall = window.innerHeight - lastSection.offsetHeight;

    this.spacer.style.height = (shortfall > 0 ? shortfall : 0) + 'px';
  }

  _attachListeners() {
    window.addEventListener('load', this._onLoad);
    window.addEventListener('resize', this._onResize);
  }

  _handleLoad() {
    this._updateSpacer();
    ScrollTrigger.refresh();
  }

  _handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this._updateSpacer();
      ScrollTrigger.refresh();
    }, this.config.resizeDebounceMs);
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
      : '.paged-scroll-section';
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
