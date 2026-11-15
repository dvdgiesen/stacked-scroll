/**
 * Type definitions for stacked-scroll.
 *
 * A small, hardened library that turns your sections into a stack of pages:
 * each header stays pinned while you read, then hands off cleanly to the next
 * page as it slides up from below.
 */

export interface StackedScrollOptions {
  /**
   * Sections to pin. A CSS selector, a single element, a NodeList, or an
   * array of elements, in document order.
   * @default '.panel'
   */
  sections?: string | HTMLElement | NodeList | HTMLElement[];

  /**
   * Selector (scoped per section) for the pinned header, used for offset
   * calculations.
   * @default '.header'
   */
  headerSelector?: string;

  /**
   * Selector (scoped per section) for the default scroll target within a
   * section.
   * @default '.main'
   */
  mainSelector?: string;

  /**
   * Selector for an existing spacer element. When omitted, an invisible
   * spacer is created and managed automatically.
   * @default null
   */
  spacerSelector?: string | null;

  /**
   * Debounce (ms) applied to resize-driven recalculations.
   * @default 200
   */
  resizeDebounceMs?: number;

  /**
   * Default scroll behavior used by `scrollTo()` unless overridden per call
   * or the user prefers reduced motion.
   * @default 'smooth'
   */
  scrollBehavior?: ScrollBehavior;

  /**
   * Viewport height (px) below which section headers are hidden/collapsed
   * via the compact class.
   * @default null
   */
  hideHeadersBelow?: number | null;

  /**
   * Class added to `<html>` when the viewport is below `hideHeadersBelow`.
   * @default 'stacked-scroll-compact'
   */
  compactClassName?: string;

  /**
   * Prevent GSAP ScrollTrigger `revert()`/`refresh()` from re-parenting pinned
   * sections while native fullscreen or manual `setFullscreenGuard(true)` is
   * active, preserving fullscreen video/iframes across resizes and rotations.
   * @default true
   */
  protectFullscreen?: boolean;

  /**
   * Direction in which incoming sections enter (and outgoing sections leave)
   * the viewport during page handoffs.
   * - `'bottom-up'`: incoming section slides vertically up from below (default).
   * - `'from-right'`: incoming section slides horizontally in from the right on
   *   scroll down and exits to the right on scroll up (newspaper page turn).
   * - `'from-left'`: incoming section slides horizontally in from the left on
   *   scroll down and exits to the left on scroll up (card swipe).
   * @default 'bottom-up'
   */
  transition?: 'bottom-up' | 'from-right' | 'from-left';

  /**
   * Enable horizontal touch-swipe dragging to turn pages when `transition` is
   * `'from-right'` or `'from-left'`.
   * @default true
   */
  touchSwipe?: boolean;

  /**
   * Optional CSS selector for horizontally interactive elements inside which
   * horizontal touch-swipe page turns should be ignored.
   * @default null
   */
  swipeIgnoreSelector?: string | null;
}

export interface ScrollToOptions {
  /**
   * Element (or selector scoped to the target section) to align to.
   * Defaults to the section's `mainSelector` element.
   */
  offsetElement?: string | HTMLElement;

  /**
   * Scroll behavior for this call. Falls back to `config.scrollBehavior`,
   * and to `'auto'` when the user prefers reduced motion.
   */
  behavior?: ScrollBehavior;
}

export declare class StackedScroll {
  constructor(options?: StackedScrollOptions);

  /**
   * Set up ScrollTriggers, the end spacer, settle buffers, and listeners.
   * Safe to call once; returns the instance for chaining.
   */
  init(): this;

  /**
   * Scroll to a section or to a specific element within a section.
   *
   * @param target Element id string, or an element (inside) the target
   *               section.
   */
  scrollTo(target: string | HTMLElement, options?: ScrollToOptions): void;

  /**
   * Re-measure all cached geometry (settle buffers, compact state, spacer,
   * triggers) after dynamic content or layout changes. Automatically anchors
   * `window.scrollY` when a pinned section shrinks (e.g. collapsing an
   * accordion or "show less" toggle) so the next section does not overlap it.
   * No-ops while fullscreen protection is active.
   */
  refresh(): void;

  /**
   * Change the page transition mode at runtime.
   */
  setTransition(mode: 'bottom-up' | 'from-right' | 'from-left'): void;

  /**
   * Manually engage or release the fullscreen guard (useful for CSS
   * pseudo-fullscreen fallbacks on browsers like iOS Safari where
   * `document.fullscreenElement` is not set).
   */
  setFullscreenGuard(active: boolean): void;

  /**
   * Tear down all ScrollTriggers, listeners, the auto-created spacer, and
   * any settle buffers.
   */
  destroy(): void;
}

export default StackedScroll;
