"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import manifest from "@/scene/manifest.json";
import wall from "@/scene/wall.json";
import { layoutScene, toCanvas, type Rect } from "@/lib/scene/layout";
import type { DeskData } from "@/lib/desk/data";
import { BUILT_BY, COFFEE, coffeeComparison, type DeepLink } from "@/lib/desk/shared";
import { headlineFont } from "../fonts";
import { AskView } from "./Ask";
import { BriefView } from "./Brief";
import { CloseButton, Dialog } from "./Dialog";
import { CalendarDoc, KpiDoc } from "./Documents";
import { EngineRoom } from "./EngineRoom";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const readSize = () => `${window.innerWidth}x${window.innerHeight}`;
const px = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const art = (w: number, ext: string) => `/art/office-phone-${manifest.version}-${w}.${ext}`;
// The whole painting for desktops and landscape tablets, 2960 by 1648.
const WIDE_ART = `/art/office-wide-${manifest.version}.webp`;

type Tab = "brief" | "ask" | "calendar" | "kpis";
type Open = null | { kind: "monitor"; tab: Tab } | { kind: "engine" } | { kind: "list" } | { kind: "coffee" } | { kind: "art"; id: string };

// What each live object does, in the order "What's on the desk" lists them (Paula's names, Tue 10/27).
// Anything not listed is set dressing, painted but not a button. The mouse opens the brief too but is not listed.
const ACTIONS: Record<string, { name: string; label: string; open: Open }> = {
  monitor: { name: "Monitor", label: "Open today\u2019s brief", open: { kind: "monitor", tab: "brief" } },
  calendar: { name: "Calendar", label: "Alex\u2019s calendar", open: { kind: "monitor", tab: "calendar" } },
  letter_tray: { name: "Letter Tray", label: "CareBird by the numbers", open: { kind: "monitor", tab: "kpis" } },
  keyboard: { name: "Keyboard", label: "Ask one of today\u2019s questions", open: { kind: "monitor", tab: "ask" } },
  coffee: { name: "Coffee", label: "What this morning\u2019s AI cost", open: { kind: "coffee" } },
  drawer_pull: { name: "Drawer Pull", label: "Open Engine Room", open: { kind: "engine" } },
  frame_large: { name: "Top Frame", label: "Rotating Art", open: { kind: "art", id: "gm" } },
  frame_small: { name: "Bottom Frame", label: "Rotating Art", open: { kind: "art", id: "cheers" } },
  mouse: { name: "Mouse", label: "Open today\u2019s brief", open: { kind: "monitor", tab: "brief" } },
};

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useNewYorkTime() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// The entry cue (a friend's note, Fri 10/30). The sleeping monitor wakes for about a second and a half, then
// asks to be opened, with a bright pulsing dot. Paula dropped the "Start here" label Fri 10/30 as duplicative.
const fineSubscribe = (onChange: () => void) => {
  const mq = window.matchMedia("(pointer: fine)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readFine = () => window.matchMedia("(pointer: fine)").matches;

function useWake() {
  // The scene renders only on the client (its size comes from the window), so this reads the browser directly.
  const [awake, setAwake] = useState(reduceMotion);
  useEffect(() => {
    if (awake) return;
    const id = setTimeout(() => setAwake(true), 1500);
    return () => clearTimeout(id);
  }, [awake]);
  return awake;
}

// What each deep link opens. Only the names in DEEP_LINK_NAMES exist, and nothing from the address is ever
// written into the page.
const DEEP_LINKS: Record<DeepLink, Exclude<Open, null>> = {
  brief: { kind: "monitor", tab: "brief" },
  ask: { kind: "monitor", tab: "ask" },
  calendar: { kind: "monitor", tab: "calendar" },
  numbers: { kind: "monitor", tab: "kpis" },
  engine: { kind: "engine" },
  coffee: { kind: "coffee" },
  gm: { kind: "art", id: "gm" },
  cheers: { kind: "art", id: "cheers" },
};

export function Desk({ data, initial }: { data: DeskData; initial?: string }) {
  const size = useSyncExternalStore(subscribe, readSize, () => "");
  const [open, setOpen] = useState<Open>(initial && initial in DEEP_LINKS ? DEEP_LINKS[initial as DeepLink] : null);
  const [zoom, setZoom] = useState(false);
  const [steam, setSteam] = useState(false);
  const time = useNewYorkTime();
  const awake = useWake();
  const fine = useSyncExternalStore(fineSubscribe, readFine, () => false);

  const decisions = data.brief.decisions.length;
  const headline = `Today: ${decisions} Decision${decisions === 1 ? "" : "s"}`;
  const wx = data.weather;
  const weatherLine = wx && wx.high != null && wx.low != null ? `${wx.emoji} ${wx.high}\u00b0/${wx.low}\u00b0` : "";

  // The wake zoom. The room scales toward the monitor for about 400ms, then the monitor opens. Instant under reduced motion.
  const go = (next: Open) => {
    if (next?.kind === "coffee") {
      setSteam(true);
      setTimeout(() => setSteam(false), 5000);
    }
    if (next?.kind === "monitor" && !reduceMotion()) {
      setZoom(true);
      setTimeout(() => {
        setOpen(next);
        setZoom(false);
      }, 400);
    } else setOpen(next);
  };
  const close = () => setOpen(null);

  if (!size) return <div className="fixed inset-0 bg-neutral-950" />;
  const [w, h] = size.split("x").map(Number) as [number, number];
  const l = layoutScene(w, h);
  const wide = l.frame === "wide";
  const monitor = l.hits.find((x) => x.id === "monitor")!.object;
  const origin = `${monitor.left + monitor.width / 2}px ${monitor.top + monitor.height * 0.4}px`;
  // The painted screen sits in the upper part of the monitor box.
  const screen: Rect = { left: monitor.left + monitor.width * 0.06, top: monitor.top + monitor.height * 0.05, width: monitor.width * 0.88, height: monitor.height * 0.62 };
  const roomy = screen.width > 200;
  // Each wall piece sits in its frame's canvas opening, measured from the master painting.
  const openingOf = (frame: keyof typeof manifest.openings): Rect => {
    const op = toCanvas(manifest.openings[frame], l.frame);
    return { left: l.scene.left + (op.x0 / 100) * l.scene.width, top: l.scene.top + (op.y0 / 100) * l.scene.height, width: ((op.x1 - op.x0) / 100) * l.scene.width, height: ((op.y1 - op.y0) / 100) * l.scene.height };
  };
  const piece = open?.kind === "art" ? wall.pieces.find((p) => p.id === open.id) : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-950 text-white">
      <div
        className="absolute inset-0 motion-safe:animate-[settle_900ms_ease-out]"
        style={{ transformOrigin: origin, transform: zoom ? "scale(2.4)" : "scale(1)", transition: zoom ? "transform 400ms ease-in" : undefined }}
      >
        {/* Tall phones show more height than the painting has, and wide screens more width, so a soft copy of it fills the space. */}
        <img aria-hidden src={wide ? WIDE_ART : art(750, "webp")} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover object-top opacity-60 blur-2xl select-none" draggable={false} />
        <div aria-hidden className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent" style={{ height: l.scene.top + 40 }} />
        <picture key={l.frame}>
          {wide ? null : <source type="image/avif" srcSet={`${art(750, "avif")} 750w, ${art(1080, "avif")} 1080w, ${art(1170, "avif")} 1170w`} sizes="100vw" />}
          <img
            src={wide ? WIDE_ART : art(1170, "webp")}
            srcSet={wide ? undefined : `${art(750, "webp")} 750w, ${art(1080, "webp")} 1080w, ${art(1170, "webp")} 1170w`}
            sizes={wide ? undefined : "100vw"}
            alt="Alex Ellery's corner office. A walnut desk with a monitor, keyboard and mouse, a desk calendar, a letter tray and a coffee cup, with floor-to-ceiling windows onto an autumn Hudson Valley forest"
            className="absolute select-none"
            style={px(l.scene)}
            draggable={false}
          />
        </picture>

        {/* The sleeping monitor. Nothing on it scrolls or animates. */}
        {wall.pieces.map((p) => (
          <picture key={p.id}>
            <source type="image/avif" srcSet={`/art/wall/${p.id}-frame.avif`} />
            <img src={`/art/wall/${p.id}-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute object-cover select-none" style={px(openingOf(p.frame as keyof typeof manifest.openings))} draggable={false} />
          </picture>
        ))}

        {/* Sizes use the screen's own width (cqw), so both lines scale with the painted monitor. The top line never wraps. */}
        <div className="absolute flex flex-col items-center justify-center gap-1 overflow-hidden rounded-sm text-center [container-type:inline-size]" style={px(screen)}>
          {awake ? (
            <>
              <span className="text-[clamp(0.4rem,5.6cqw,0.9rem)] whitespace-nowrap text-white/60 tabular-nums">
                {time ? `${time} in New York` : ""}
                {time && weatherLine ? ` \u00b7 ${weatherLine}` : ""}
              </span>
              <span className={`${headlineFont.className} text-[clamp(0.8rem,13cqw,1.6rem)] leading-tight font-semibold tracking-tight`}>{headline}</span>
              <span className="mt-[2cqw] inline-flex items-center gap-[3cqw] rounded-full bg-sky-300/20 px-[5cqw] py-[1.5cqw] text-[clamp(0.45rem,6.5cqw,0.85rem)] font-semibold whitespace-nowrap text-sky-100 ring-1 ring-sky-200/40">
                <span aria-hidden className="relative flex size-[clamp(0.4rem,4.5cqw,0.6rem)]">
                  <span className="absolute inset-0 rounded-full bg-lime-300 motion-safe:animate-ping" />
                  <span className="relative size-full rounded-full bg-lime-300 shadow-[0_0_8px_2px_rgba(190,242,100,0.85)]" />
                </span>
                {fine ? "Click to open" : "Tap to open"}
              </span>
              {roomy ? <span className="px-2 text-[0.6rem] text-white/50">{data.honesty} <em>{BUILT_BY}</em></span> : null}
            </>
          ) : (
            <span className="flex w-[70%] flex-col items-center gap-[3cqw] text-[clamp(0.4rem,5.6cqw,0.85rem)] tracking-wide text-white/60">
              Waking up
              <span className="h-[clamp(2px,1.6cqw,5px)] w-full overflow-hidden rounded-full bg-white/15">
                <span className="block h-full w-full origin-left animate-[wake_1.4s_ease-out_forwards] rounded-full bg-sky-200/80" />
              </span>
            </span>
          )}
        </div>

        {l.hits.map((t) => {
          const a = ACTIONS[t.id];
          if (!a) return null;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`${a.name}, ${a.label}`}
              data-testid={`hit-${t.id}`}
              onClick={() => go(a.open)}
              className="absolute rounded-md focus-visible:outline-4 focus-visible:outline-sky-300 hover:bg-white/5"
              style={px(t.hit)}
            />
          );
        })}

        {steam ? (
          <div aria-hidden className="pointer-events-none absolute" style={px(l.hits.find((x) => x.id === "coffee")!.object)}>
            <div className="absolute -top-6 left-1/2 h-8 w-6 -translate-x-1/2 animate-[steam_5s_ease-out] rounded-full bg-white/30 blur-md" />
          </div>
        ) : null}
      </div>

      <header className="absolute inset-x-0 top-0 flex h-14 items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4">
        <h1 className={`${headlineFont.className} text-2xl font-bold tracking-tight drop-shadow`}>Corner Office</h1>
        <button type="button" onClick={() => go({ kind: "list" })} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-medium backdrop-blur hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-300">
          What’s on the desk
        </button>
      </header>

      {/* The dock sits below the painting, near the thumb, with the phone's bottom inset added under it. On a
          screen too short for that, it sits on the painted desk-front band instead. */}
      <nav
        aria-label="Desk"
        className={`absolute inset-x-0 flex justify-center gap-2 px-4 ${l.dockMode === "below" ? "bottom-0 items-start pt-3 pb-[env(safe-area-inset-bottom)]" : "items-center bg-gradient-to-t from-black/70 to-transparent"}`}
        style={l.dockMode === "below" ? { height: `calc(${l.dock.height}px + env(safe-area-inset-bottom, 0px))` } : { top: l.dock.top, height: l.dock.height }}
      >
        <DockButton onClick={() => go({ kind: "monitor", tab: "brief" })}>Today’s Brief</DockButton>
        <DockButton onClick={() => go({ kind: "engine" })}>Engine Room</DockButton>
      </nav>

      <Dialog open={open?.kind === "monitor"} onClose={close} label="Monitor" className="h-[100dvh] w-[100vw] sm:h-[92dvh] sm:w-[min(760px,96vw)] sm:rounded-2xl">
        {open?.kind === "monitor" ? <Monitor data={data} tab={open.tab} setTab={(tab) => setOpen({ kind: "monitor", tab })} onClose={close} /> : null}
      </Dialog>

      <Dialog open={open?.kind === "engine"} onClose={close} label="Engine Room" className="h-[100dvh] w-[100vw] sm:h-[92dvh] sm:w-[min(760px,96vw)] sm:rounded-2xl">
        <Frame title="Engine Room" onClose={close} honesty={data.honesty}>
          <EngineRoom data={data} />
        </Frame>
      </Dialog>

      <Dialog open={open?.kind === "art"} onClose={close} label={piece ? `${piece.title}, a painting by Paula McMahon` : "On the wall"} className="h-[100dvh] w-[100vw] sm:h-auto sm:max-h-[92dvh] sm:w-[min(560px,96vw)] sm:rounded-2xl">
        <Frame title="On the wall" onClose={close} honesty={data.honesty}>
          {piece ? <Placard piece={piece} /> : null}
        </Frame>
      </Dialog>

      <Dialog open={open?.kind === "coffee"} onClose={close} label="Coffee" className="w-[min(420px,92vw)] rounded-2xl">
        <div className="space-y-2 bg-neutral-900 p-5 text-sm text-white">
          <h2 className="text-base font-semibold">This morning’s AI</h2>
          <p>
            ${(data.morningCostMicroUsd / 1e6).toFixed(2)} for the brief and {data.asks.length === 6 ? "six" : data.asks.length} answers, at list price.
          </p>
          <p>That’s {coffeeComparison(data.morningCostMicroUsd / 1e6)}.</p>
          <p className="text-xs text-white/50">
            Coffee at ${COFFEE.pricePerPound.toFixed(2)} a pound, U.S. average, {COFFEE.month} (U.S. BLS).
          </p>
          <div className="flex justify-end">
            <CloseButton onClose={close} />
          </div>
        </div>
      </Dialog>

      <Dialog open={open?.kind === "list"} onClose={close} label="What's on the desk" className="h-[100dvh] w-[100vw] sm:h-auto sm:max-h-[92dvh] sm:w-[min(520px,96vw)] sm:rounded-2xl">
        <Frame title="What's on the desk" onClose={close} honesty={data.honesty}>
          <ul className="divide-y divide-white/10 text-sm">
            {Object.entries(ACTIONS)
              .filter(([id]) => id !== "mouse")
              .map(([id, a]) => (
                <li key={id}>
                  <button type="button" onClick={() => setOpen(a.open)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-sky-300">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-white/60">{a.label}</span>
                  </button>
                </li>
              ))}
          </ul>
        </Frame>
      </Dialog>
    </div>
  );
}

function DockButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded-full bg-white/15 px-4 text-sm font-medium backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-sky-300">
      {children}
    </button>
  );
}

// Monitor mode. A thin bezel frames every document on every device.
function Frame({ title, onClose, honesty, tabs, children }: { title: string; onClose: () => void; honesty: string; tabs?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full max-h-[100dvh] flex-col border-[6px] border-neutral-800 bg-neutral-900 text-white sm:max-h-[92dvh] sm:rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1">
        <span className="text-sm font-semibold">{title}</span>
        <CloseButton onClose={onClose} />
      </div>
      {tabs}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [container-type:inline-size]">{children}</div>
      <p className="border-t border-white/10 px-4 py-2 text-[0.7rem] text-white/50">
        {honesty} <em>{BUILT_BY}</em>
      </p>
    </div>
  );
}

function Monitor({ data, tab, setTab, onClose }: { data: DeskData; tab: Tab; setTab: (t: Tab) => void; onClose: () => void }) {
  const tabs: [Tab, string][] = [
    ["brief", "Brief"],
    ["ask", "Ask"],
    ["calendar", "Calendar"],
    ["kpis", "Numbers"],
  ];
  return (
    <Frame
      title={data.persona.name}
      onClose={onClose}
      honesty={data.honesty}
      tabs={
        <div role="tablist" aria-label="Monitor" className="flex gap-1 border-b border-white/10 px-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-11 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-300 ${tab === id ? "border-b-2 border-sky-300 text-white" : "text-white/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div role="tabpanel">
        {tab === "brief" ? <BriefView data={data} /> : null}
        {tab === "calendar" ? <CalendarDoc data={data} /> : null}
        {tab === "kpis" ? <KpiDoc data={data} /> : null}
        {tab === "ask" ? <AskView data={data} /> : null}
      </div>
    </Frame>
  );
}

// The wall piece and its placard. The prompt stays in scene/wall.json for provenance and is not shown.
function Placard({ piece }: { piece: (typeof wall.pieces)[number] }) {
  return (
    <figure className="space-y-3">
      <picture>
        <source type="image/avif" srcSet={`/art/wall/${piece.id}-full.avif`} />
        <img src={`/art/wall/${piece.id}-full.webp`} alt={piece.alt} className="mx-auto max-h-[60dvh] w-auto rounded-sm border-[6px] border-[#2a2018] shadow-lg" />
      </picture>
      <figcaption className="mx-auto max-w-sm rounded-md bg-[#f7f3ea] p-4 text-sm text-[#1d1b18]">
        <p className="text-base font-semibold italic">{piece.title}</p>
        <p>{piece.credit}, {piece.made}</p>
        <p className="mt-2 text-xs text-black/60">{piece.curation}</p>
      </figcaption>
    </figure>
  );
}

