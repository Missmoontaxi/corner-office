// Scene layout over Paula's locked painting (scene/manifest.json, art-v1).
// Desktops and landscape tablets show the whole wide painting, fit between the top bar and the dock.
// Phones show a crop of the wide painting plus a band of desk front below it. The canvas fits the screen's
// width and is centered between the top bar and the dock, which sits below the painting near the bottom edge
// (Paula's note, Tue 10/27). A screen too short for that shrinks the canvas instead of overlapping either.
// Hit areas are padded to 44 points, then kept clear of the top bar and the dock.
import manifest from "@/scene/manifest.json";

export const MIN_HIT = 44;
// One row of 44-point controls, the one-line byline under it, and a little scrim above and below.
export const TOP_BAR_HEIGHT = 72;
// The dock below the painting. One row of 44-point buttons plus room above and below. The phone's own
// bottom inset is added in CSS, below this.
export const DOCK_HEIGHT = 68;
// Breathing room between a hit area and the top bar or dock.
export const CHROME_GAP = 4;

export type Box = { x0: number; x1: number; y0: number; y1: number };
export type Rect = { left: number; top: number; width: number; height: number };

type ManifestObject = { id: string; live: string; box: Box; hit?: Box };

export type HitArea = { id: string; live: string; object: Rect; hit: Rect };

// "wide" is the whole painting, "phone" is the phone crop with its desk-front band.
export type Frame = "phone" | "wide";

export type SceneLayout = {
  viewport: { width: number; height: number };
  frame: Frame;
  scene: Rect;
  safeFrame: Rect;
  topBar: Rect;
  dock: Rect;
  // "below" puts the dock under the painting. "over" puts it on the painted desk-front band, for screens too
  // short for both the room and a separate dock.
  dockMode: "below" | "over";
  hits: HitArea[];
};

const ASPECT = manifest.canvas.height / manifest.canvas.width;
const { crop_x0, crop_x1 } = manifest.phone;
const PAINT_SHARE = manifest.source.height / manifest.canvas.height;
const WIDE_ASPECT = manifest.source.height / manifest.source.width;
// The wide painting needs a landscape screen at least this wide. Anything narrower or taller keeps the phone crop.
export const WIDE_MIN_WIDTH = 768;

export function frameFor(width: number, height: number): Frame {
  return width >= WIDE_MIN_WIDTH && width > height ? "wide" : "phone";
}

// Source-image percent to scene percent. The wide frame is the source itself.
export function toCanvas(b: Box, frame: Frame = "phone"): Box {
  if (frame === "wide") return b;
  const x = (v: number) => ((v - crop_x0) / (crop_x1 - crop_x0)) * 100;
  const y = (v: number) => v * PAINT_SHARE;
  return { x0: x(b.x0), x1: x(b.x1), y0: y(b.y0), y1: y(b.y1) };
}

// Everything that gets a button on phones. The phone on the desk is set dressing, and the door and the
// wall screen sit outside the phone crop, so phones reach those through the button row instead.
export function liveTargets(frame: Frame = "phone"): { id: string; live: string; box: Box; hit: Box }[] {
  return (manifest.objects as ManifestObject[])
    .filter((o) => o.live !== "set dressing")
    .map((o) => ({ id: o.id, live: o.live, box: toCanvas(o.box, frame), hit: toCanvas(o.hit ?? o.box, frame) }));
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

  const frame = frameFor(width, height);
  const topBar: Rect = { left: 0, top: 0, width, height: TOP_BAR_HEIGHT };
  const room = height - TOP_BAR_HEIGHT - DOCK_HEIGHT;
  const fullH = width * ASPECT;

  let scene: Rect;
  let dock: Rect;
  let dockMode: SceneLayout["dockMode"];
  if (frame === "wide") {
    // The whole painting, as large as fits between the top bar and the dock, centered both ways.
    const sceneW = Math.min(width, room / WIDE_ASPECT);
    const sceneH = sceneW * WIDE_ASPECT;
    scene = { left: (width - sceneW) / 2, top: TOP_BAR_HEIGHT + (room - sceneH) / 2, width: sceneW, height: sceneH };
    dock = { left: 0, top: height - DOCK_HEIGHT, width, height: DOCK_HEIGHT };
    dockMode = "below";
  } else if (fullH * safeShare <= room) {
    // Room for both. The painting is centered between the top bar and the dock below it.
    scene = { left: 0, top: TOP_BAR_HEIGHT + (room - fullH) / 2, width, height: fullH };
    dock = { left: 0, top: height - DOCK_HEIGHT, width, height: DOCK_HEIGHT };
    dockMode = "below";
  } else {
    // A short screen. The painting keeps its full width under the top bar, shrinking only if it is taller than
    // the screen, and the dock sits on its painted desk-front band, which was painted for this.
    let sceneW = width;
    let sceneH = fullH;
    if (sceneH * safeShare > height) {
      sceneH = height / safeShare;
      sceneW = sceneH / ASPECT;
    }
    scene = { left: (width - sceneW) / 2, top: Math.min(TOP_BAR_HEIGHT, height - sceneH), width: sceneW, height: sceneH };
    dock = toRect({ x0: 0, x1: 100, y0: z.dock_band.y0, y1: z.dock_band.y1 }, scene);
    dockMode = "over";
  }
  const safeFrame = frame === "wide" ? scene : toRect(z.safe_frame, scene);

  const minTop = topBar.top + topBar.height + CHROME_GAP;
  const maxBottom = dock.top - CHROME_GAP;

  const hits = liveTargets(frame).map(({ id, live, box, hit: hitBox }) => {
    const object = toRect(box, scene);
    const h = toRect(hitBox, scene);
    const [l, r] = padAxis(h.left, h.width);
    let [t, b] = padAxis(h.top, h.height);
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

  return { viewport: { width, height }, frame, scene, safeFrame, topBar, dock, dockMode, hits };
}
