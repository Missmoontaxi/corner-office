// Phone scene layout, per Desk Addendum section 2.2.
// The 9:16 canvas fits the screen's width and sits on the bottom edge. A short screen crops ceiling,
// and a screen too short for the safe frame scales the scene down until the safe frame fits.
// Hit areas are padded to 44 points, then kept clear of the top bar and the dock band.
import manifest from "@/scene/manifest.json";

export const MIN_HIT = 44;
// One row of 44-point controls plus 6 points of scrim above and below.
export const TOP_BAR_HEIGHT = 56;
// Breathing room between a hit area and the top bar or dock.
export const CHROME_GAP = 4;

export type Box = { x0: number; x1: number; y0: number; y1: number };
export type Rect = { left: number; top: number; width: number; height: number };

type ManifestObject = Box & { id: string; live: string; hit_y0?: number };

export type HitArea = { id: string; live: string; object: Rect; hit: Rect };

export type SceneLayout = {
  viewport: { width: number; height: number };
  scene: Rect;
  safeFrame: Rect;
  topBar: Rect;
  dock: Rect;
  hits: HitArea[];
};

const ASPECT = manifest.canvas.height / manifest.canvas.width;

// Everything that gets a button, now or later. The phone is set dressing until Paula says otherwise.
export function liveTargets(): { id: string; live: string; box: Box }[] {
  const objects = (manifest.objects as ManifestObject[])
    .filter((o) => o.live !== "set dressing")
    .map((o) => ({ id: o.id, live: o.live, box: { ...o, y0: o.hit_y0 ?? o.y0 } }));
  const door = manifest.set_dressing.door;
  return [...objects, { id: "door", live: "future", box: door.future_live }];
}

function toRect(b: Box, scene: Rect): Rect {
  return {
    left: scene.left + (b.x0 / 100) * scene.width,
    top: scene.top + (b.y0 / 100) * scene.height,
    width: ((b.x1 - b.x0) / 100) * scene.width,
    height: ((b.y1 - b.y0) / 100) * scene.height,
  };
}

function padAxis(start: number, size: number): [number, number] {
  if (size >= MIN_HIT) return [start, start + size];
  const grow = (MIN_HIT - size) / 2;
  return [start - grow, start + size + grow];
}

export function layoutScene(width: number, height: number): SceneLayout {
  const z = manifest.zones;
  const safeShare = (z.safe_frame.y1 - z.safe_frame.y0) / 100;

  let sceneW = width;
  let sceneH = width * ASPECT;
  if (sceneH * safeShare > height) {
    sceneH = height / safeShare;
    sceneW = sceneH / ASPECT;
  }
  const scene: Rect = { left: (width - sceneW) / 2, top: height - sceneH, width: sceneW, height: sceneH };

  const safeFrame = toRect(z.safe_frame, scene);
  const dock = toRect({ x0: 0, x1: 100, y0: z.dock_band.y0, y1: z.dock_band.y1 }, scene);
  const topBar: Rect = { left: 0, top: 0, width, height: TOP_BAR_HEIGHT };

  const minTop = topBar.top + topBar.height + CHROME_GAP;
  const maxBottom = dock.top - CHROME_GAP;

  const hits = liveTargets().map(({ id, live, box }) => {
    const object = toRect(box, scene);
    const [l, r] = padAxis(object.left, object.width);
    let [t, b] = padAxis(object.top, object.height);
    // Slide or trim away from the chrome. The test then proves the result is still 44 by 44.
    if (t < minTop) {
      t = minTop;
      b = Math.max(b, t + MIN_HIT);
    }
    if (b > maxBottom) {
      b = maxBottom;
      t = Math.min(t, b - MIN_HIT);
    }
    return { id, live, object, hit: { left: l, top: t, width: r - l, height: b - t } };
  });

  return { viewport: { width, height }, scene, safeFrame, topBar, dock, hits };
}
