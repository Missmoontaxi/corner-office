"use client";

import { useSyncExternalStore } from "react";
import manifest from "@/scene/manifest.json";
import { layoutScene, type Rect } from "@/lib/scene/layout";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const readSize = () => `${window.innerWidth}x${window.innerHeight}`;

const px = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const art = (w: number, ext: string) => `/art/office-phone-${manifest.version}-${w}.${ext}`;

// The phone scene over Paula's painting with live hit areas drawn on top, for the viewport matrix.
export default function SceneBench() {
  const size = useSyncExternalStore(subscribe, readSize, () => "");
  if (!size) return null;
  const [w, h] = size.split("x").map(Number) as [number, number];
  const l = layoutScene(w, h);

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-900" data-testid="viewport">
      <picture>
        <source type="image/avif" srcSet={`${art(750, "avif")} 750w, ${art(1080, "avif")} 1080w, ${art(1170, "avif")} 1170w`} sizes="100vw" />
        <img
          src={art(1170, "webp")}
          srcSet={`${art(750, "webp")} 750w, ${art(1080, "webp")} 1080w, ${art(1170, "webp")} 1170w`}
          sizes="100vw"
          alt="A corner office with a walnut desk and a dark monitor, floor-to-ceiling windows onto an autumn Hudson Valley forest"
          className="absolute"
          style={px(l.scene)}
          data-testid="scene"
        />
      </picture>
      <div className="pointer-events-none absolute border-2 border-dashed border-sky-400/70" style={px(l.safeFrame)} data-testid="safe-frame" />
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
