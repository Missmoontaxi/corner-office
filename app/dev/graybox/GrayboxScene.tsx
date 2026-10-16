"use client";

import { useSyncExternalStore } from "react";
import manifest from "@/scene/manifest.json";
import { layoutScene, type Box, type Rect } from "@/lib/scene/layout";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const readSize = () => `${window.innerWidth}x${window.innerHeight}`;

const px = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });

function boxIn(b: Box, scene: Rect): Rect {
  return {
    left: scene.left + (b.x0 / 100) * scene.width,
    top: scene.top + (b.y0 / 100) * scene.height,
    width: ((b.x1 - b.x0) / 100) * scene.width,
    height: ((b.y1 - b.y0) / 100) * scene.height,
  };
}

// The gray-box drawn in the browser with live hit areas over it, for the viewport matrix.
export default function GrayboxScene() {
  const size = useSyncExternalStore(subscribe, readSize, () => "");
  if (!size) return null;
  const [w, h] = size.split("x").map(Number) as [number, number];
  const l = layoutScene(w, h);
  const sd = manifest.set_dressing;

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-900" data-testid="viewport">
      <div className="absolute bg-[#8f8f8f]" style={px(l.scene)} data-testid="scene" />
      {[sd.far_wall, sd.glass_left_run, sd.door, sd.interior_wall_right, sd.side_wall_interior, sd.desk_top, sd.desk_front].map(
        (b, i) => (
          <div key={i} className="absolute border border-neutral-700/40 bg-neutral-400/60" style={px(boxIn(b, l.scene))} />
        ),
      )}
      {manifest.objects.map((o) => (
        <div key={o.id} className="absolute rounded bg-neutral-300" style={px(boxIn(o, l.scene))} />
      ))}
      <div className="pointer-events-none absolute border-2 border-dashed border-sky-400" style={px(l.safeFrame)} data-testid="safe-frame" />
      {l.hits.map((t) => (
        <div key={t.id} className="pointer-events-none absolute" style={px(t.object)} data-testid={`obj-${t.id}`} />
      ))}
      {l.hits.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={t.id.replace("_", " ")}
          data-testid={`hit-${t.id}`}
          data-live={t.live}
          className="absolute rounded border-2 border-rose-500/80 bg-rose-500/10 focus-visible:outline-4 focus-visible:outline-sky-300"
          style={px(t.hit)}
        />
      ))}
      <div className="absolute bg-black/45" style={px(l.topBar)} data-testid="top-bar" />
      <div className="absolute bg-black/45" style={px(l.dock)} data-testid="dock" />
    </div>
  );
}
