// Viewport matrix, Desk Addendum section 2.2. At every size the whole safe frame is visible,
// every hit area is at least 44 by 44 points, and no hit area touches the top bar or the dock band.
import { expect, test } from "@playwright/test";

const SIZES: [number, number, string][] = [
  [375, 548, "iPhone SE, in-app browser"],
  [390, 620, "current iPhone, X or LinkedIn"],
  [393, 660, "current iPhone, Gmail"],
  [360, 640, "small Android"],
  [412, 780, "large Android"],
  [390, 844, "full iPhone screen"],
  [412, 870, "tall Android, Chrome"],
  [1280, 720, "laptop, the whole painting"],
  [1440, 900, "MacBook, the whole painting"],
  [1920, 1080, "desktop monitor, the whole painting"],
];

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const EPS = 0.5;

for (const [width, height, label] of SIZES) {
  test(`${width}x${height} (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/dev/scene");
    await page.getByTestId("safe-frame").waitFor();

    const m = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const one = (id: string) => box(document.querySelector(`[data-testid="${id}"]`)!);
      const hits = [...document.querySelectorAll<HTMLElement>('[data-testid^="hit-"]')].map((el) => {
        const id = el.dataset.testid!.slice(4);
        const b = box(el);
        const top = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
        return { id, hit: b, object: one(`obj-${id}`), reachable: top === el };
      });
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        scene: one("scene"),
        safe: one("safe-frame"),
        topBar: one("top-bar"),
        dock: one("dock"),
        hits,
      };
    });

    expect(m.vw).toBe(width);
    expect(m.vh).toBe(height);

    // Tall enough screens center the scene between the top bar and a dock below it. Short ones put the dock on
    // the scene's painted desk-front band. Either way the scene is on screen and never cropped at the sides.
    expect(m.scene.bottom).toBeLessThanOrEqual(height + EPS);
    if (m.dock.top >= m.scene.bottom - EPS) {
      expect(m.scene.top, "scene below the top bar").toBeGreaterThanOrEqual(m.topBar.bottom - EPS);
      expect(Math.abs(m.scene.top - m.topBar.bottom - (m.dock.top - m.scene.bottom)), "scene centered").toBeLessThan(1.5);
    } else {
      expect(Math.abs(m.dock.bottom - m.scene.bottom), "dock on the painted band").toBeLessThan(1);
    }
    expect(m.scene.left).toBeGreaterThanOrEqual(-EPS);
    expect(m.scene.right).toBeLessThanOrEqual(width + EPS);

    // The whole safe frame is on screen.
    expect(m.safe.top, "safe frame top").toBeGreaterThanOrEqual(-EPS);
    expect(m.safe.left).toBeGreaterThanOrEqual(-EPS);
    expect(m.safe.right).toBeLessThanOrEqual(width + EPS);
    expect(m.safe.bottom).toBeLessThanOrEqual(height + EPS);

    expect(m.hits.length).toBeGreaterThan(0);
    for (const h of m.hits) {
      const name = `${h.id} at ${width}x${height}`;
      expect(h.hit.width, `${name} width`).toBeGreaterThanOrEqual(44 - EPS);
      expect(h.hit.height, `${name} height`).toBeGreaterThanOrEqual(44 - EPS);
      expect(h.hit.top, `${name} clears the top bar`).toBeGreaterThan(m.topBar.bottom);
      expect(h.hit.bottom, `${name} clears the dock band`).toBeLessThan(m.dock.top);
      expect(h.hit.left, `${name} inside the screen`).toBeGreaterThanOrEqual(-EPS);
      expect(h.hit.right, `${name} inside the screen`).toBeLessThanOrEqual(width + EPS);
      expect(h.hit.top, `${name} inside the safe frame`).toBeGreaterThanOrEqual(m.safe.top - EPS);
      // The padded area still covers the middle of the object it belongs to.
      const cx = (h.object.left + h.object.right) / 2;
      const cy = (h.object.top + h.object.bottom) / 2;
      expect(cx >= h.hit.left && cx <= h.hit.right && cy >= h.hit.top && cy <= h.hit.bottom, `${name} covers its object`).toBe(true);
      expect(h.reachable, `${name} is the top element at its center`).toBe(true);
    }

    // No two hit areas share any space, so a tap always means one thing.
    const overlaps: string[] = [];
    const meet = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    m.hits.forEach((a, i) =>
      m.hits.slice(i + 1).forEach((b) => {
        if (meet(a.hit, b.hit)) overlaps.push(`${a.id} / ${b.id}`);
      }),
    );
    expect(overlaps, "overlapping hit areas").toEqual([]);
  });
}
