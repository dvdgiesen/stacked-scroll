import { test, expect } from '@playwright/test';

const TOLERANCE = 10;

async function waitForScroller(page) {
  await page.waitForFunction(() => typeof window.scroller !== 'undefined' && window.scroller !== null);
}

test.describe('StackedScroll demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForLoadState('networkidle');
    await waitForScroller(page);
  });

  test('deep-link from cover to last short section lands flush-top', async ({ page }) => {
    await page.evaluate(() => window.scroller.scrollTo('contact', { behavior: 'auto' }));

    const offset = await page.evaluate(() => {
      const contact = document.getElementById('contact');
      return contact.getBoundingClientRect().top;
    });

    expect(Math.abs(offset)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('deep-link from last section back to cover lands flush-top', async ({ page }) => {
    await page.evaluate(() => window.scroller.scrollTo('contact', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    await page.evaluate(() => window.scroller.scrollTo('cover', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    const offset = await page.evaluate(() => {
      const cover = document.getElementById('cover');
      return cover.getBoundingClientRect().top;
    });

    expect(Math.abs(offset)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('deep-link between tall and short sections lands within tolerance', async ({ page }) => {
    await page.evaluate(() => window.scroller.scrollTo('gallery', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    await page.evaluate(() => window.scroller.scrollTo('highlight', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    const offset = await page.evaluate(() => {
      const highlight = document.getElementById('highlight');
      return highlight.getBoundingClientRect().top;
    });

    expect(Math.abs(offset)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('last short section reaches flush-top after viewport resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForScroller(page);

    await page.evaluate(() => window.scroller.scrollTo('contact', { behavior: 'auto' }));

    const offset = await page.evaluate(() => {
      const contact = document.getElementById('contact');
      return contact.getBoundingClientRect().top;
    });

    expect(Math.abs(offset)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('previous panel releases at the last transition so headers do not overlap', async ({ page }) => {
    // Scroll to the final section. With the pin-end clamp fix, the previous
    // panel must no longer be position:fixed, and the final panel's header
    // must be the visible one at the top of the viewport.
    await page.evaluate(() => window.scroller.scrollTo('contact', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const contactHeader = document.querySelector('#contact .header');
      return {
        galleryPosition: window.getComputedStyle(gallery).position,
        contactHeaderTop: contactHeader.getBoundingClientRect().top,
        contactHeaderVisible: document.elementsFromPoint(10, 10)
          .some(el => el.classList.contains('header') && el.closest('#contact'))
      };
    });

    expect(result.galleryPosition).not.toBe('fixed');
    expect(Math.abs(result.contactHeaderTop)).toBeLessThanOrEqual(TOLERANCE);
    expect(result.contactHeaderVisible).toBe(true);
  });

  test('hamburger nav opens, closes, and scrolls to target', async ({ page }) => {
    // Open the cover section's mobile-style navigation.
    await page.click('#cover .mobile-nav-toggle');
    await page.waitForTimeout(250);

    const openInfo = await page.evaluate(() => {
      const nav = document.querySelector('#cover .mobile-nav');
      const btn = document.querySelector('#cover .mobile-nav-toggle');
      return {
        isOpen: nav.classList.contains('is-open'),
        expanded: btn.getAttribute('aria-expanded'),
        navHeight: nav.getBoundingClientRect().height,
      };
    });

    expect(openInfo.isOpen).toBe(true);
    expect(openInfo.expanded).toBe('true');
    expect(openInfo.navHeight).toBeGreaterThan(0);

    // Click the Contact item; menu should close and page should scroll there.
    await page.click('#cover .mobile-nav-item:last-child');
    // Smooth scroll can take a while for a far target, so wait until the
    // contact panel has actually landed flush with the top of the viewport.
    await page.waitForFunction(() => {
      const contact = document.getElementById('contact');
      return Math.abs(contact.getBoundingClientRect().top) <= 10;
    }, { timeout: 4000 });

    const closeInfo = await page.evaluate(() => {
      const nav = document.querySelector('#cover .mobile-nav');
      const btn = document.querySelector('#cover .mobile-nav-toggle');
      const contact = document.getElementById('contact');
      return {
        isOpen: nav.classList.contains('is-open'),
        expanded: btn.getAttribute('aria-expanded'),
        contactTop: contact.getBoundingClientRect().top,
      };
    });

    expect(closeInfo.isOpen).toBe(false);
    expect(closeInfo.expanded).toBe('false');
    expect(Math.abs(closeInfo.contactTop)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('last section stays flush after menu navigation and opening its hamburger', async ({ page }) => {
    // Regression for a stale-geometry bug: navigating from an open hamburger
    // could leave GSAP pin spacers in the expanded state; opening the last
    // section's hamburger afterwards would then shift that section down and
    // reveal the previous panel above it.
    await page.click('#cover .mobile-nav-toggle');
    await page.waitForTimeout(250);
    await page.click('#cover .mobile-nav-item:last-child');
    await page.waitForFunction(() => {
      const contact = document.getElementById('contact');
      return Math.abs(contact.getBoundingClientRect().top) <= 10;
    }, { timeout: 4000 });
    // The smooth scroll may still be settling; wait for it to finish before
    // interacting with the target section.
    await page.waitForTimeout(1500);

    // Open the last section's hamburger — it must stay flush and on top.
    await page.click('#contact .mobile-nav-toggle');
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      const contact = document.getElementById('contact');
      const gallery = document.getElementById('gallery');
      const topEl = document.elementFromPoint(Math.floor(window.innerWidth / 2), 20);
      const bottomEl = document.elementFromPoint(Math.floor(window.innerWidth / 2), window.innerHeight - 20);
      const cr = contact.getBoundingClientRect();
      return {
        contactTop: cr.top,
        contactHeight: cr.height,
        viewportHeight: window.innerHeight,
        topInsideContact: topEl ? contact.contains(topEl) : false,
        bottomInsideContact: bottomEl ? contact.contains(bottomEl) : false,
        galleryPosition: window.getComputedStyle(gallery).position,
      };
    });

    expect(Math.abs(result.contactTop)).toBeLessThanOrEqual(TOLERANCE);
    expect(result.contactHeight).toBeGreaterThanOrEqual(result.viewportHeight);
    expect(result.topInsideContact).toBe(true);
    expect(result.bottomInsideContact).toBe(true);
    expect(result.galleryPosition).not.toBe('fixed');
  });

  test('last section fully covers the viewport so the previous panel does not show through', async ({ page }) => {
    // Regression for a demo bug: a short-content last section must still have
    // min-height: 100vh so the previous panel does not show through below it.
    await page.evaluate(() => window.scroller.scrollTo('contact', { behavior: 'auto' }));
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const contact = document.getElementById('contact');
      const gallery = document.getElementById('gallery');
      const viewportHeight = window.innerHeight;
      const cr = contact.getBoundingClientRect();
      // Probe near the bottom edge of the viewport.
      const bottomEl = document.elementFromPoint(200, viewportHeight - 20);

      return {
        contactHeight: cr.height,
        contactTop: cr.top,
        contactBottom: cr.bottom,
        viewportHeight,
        galleryPosition: window.getComputedStyle(gallery).position,
        bottomElementInsideContact: bottomEl ? contact.contains(bottomEl) : false,
      };
    });

    // Contact should fill the viewport, be flush at the top, and be on top at
    // the bottom of the screen (not gallery).
    expect(result.contactHeight).toBeGreaterThanOrEqual(result.viewportHeight);
    expect(Math.abs(result.contactTop)).toBeLessThanOrEqual(TOLERANCE);
    expect(result.bottomElementInsideContact).toBe(true);
    expect(result.galleryPosition).not.toBe('fixed');
  });
});

test.describe('Adjacent short panels regression', () => {
  test('deep-link to a short panel while it is pinned lands correctly', async ({ page }) => {
    await page.goto('/tests/fixtures/adjacent-short.html');
    await page.waitForLoadState('networkidle');
    await waitForScroller(page);

    // Scroll into the tall panel C; panel B stays pinned above it.
    await page.evaluate(() => window.scroller.scrollTo('c', { behavior: 'auto' }));
    await page.waitForTimeout(100);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    // Jump back to panel B while it is currently pinned/fixed.
    await page.evaluate(() => window.scroller.scrollTo('b', { behavior: 'auto' }));
    await page.waitForTimeout(100);

    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeLessThan(scrollBefore);

    const offset = await page.evaluate(() => {
      const b = document.getElementById('b');
      return b.getBoundingClientRect().top;
    });

    expect(Math.abs(offset)).toBeLessThanOrEqual(TOLERANCE);
  });

  test('two adjacent short panels hand off cleanly without overlap', async ({ page }) => {
    await page.goto('/tests/fixtures/adjacent-short.html');
    await page.waitForLoadState('networkidle');
    await waitForScroller(page);

    // Scroll to panel B. The synthetic settle buffer should ensure panel A
    // has released by the time B pins, so they never share the fixed layer.
    await page.evaluate(() => window.scroller.scrollTo('b', { behavior: 'auto' }));
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      const a = document.getElementById('a');
      const b = document.getElementById('b');
      return {
        aPosition: window.getComputedStyle(a).position,
        bTop: b.getBoundingClientRect().top,
        bPosition: window.getComputedStyle(b).position,
      };
    });

    // B should be pinned flush at the top of the viewport.
    expect(Math.abs(result.bTop)).toBeLessThanOrEqual(TOLERANCE);
    expect(result.bPosition).toBe('fixed');

    // A should have released; it must not still be position:fixed.
    expect(result.aPosition).not.toBe('fixed');
  });
});
