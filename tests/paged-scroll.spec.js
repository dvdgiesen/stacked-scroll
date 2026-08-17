import { test, expect } from '@playwright/test';

const TOLERANCE = 10;

async function waitForScroller(page) {
  await page.waitForFunction(() => typeof window.scroller !== 'undefined' && window.scroller !== null);
}

test.describe('PagedScroll demo', () => {
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
});
