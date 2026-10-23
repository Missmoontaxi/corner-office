"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import manifest from "@/scene/manifest.json";
import { layoutScene, type Rect } from "@/lib/scene/layout";
import type { DeskData } from "@/lib/desk/data";
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

type Tab = "brief" | "ask" | "calendar" | "kpis";
type Open = null | { kind: "monitor"; tab: Tab } | { kind: "engine" } | { kind: "list" } | { kind: "coffee" };

// What each live object does on 10/22. Anything not listed is set dressing, painted but not a button.
const ACTIONS: Record<string, { label: string; open: Open }> = {
  monitor: { label: "Open today's brief", open: { kind: "monitor", tab: "brief" } },
  mouse: { label: "Open today's brief", open: { kind: "monitor", tab: "brief" } },
  calendar: { label: "Alex's calendar", open: { kind: "monitor", tab: "calendar" } },
  letter_tray: { label: "The numbers, in the letter tray", open: { kind: "monitor", tab: "kpis" } },
  keyboard: { label: "Ask one of six questions", open: { kind: "monitor", tab: "ask" } },
  coffee: { label: "What this morning's AI cost", open: { kind: "coffee" } },
  drawer_pull: { label: "Open the Engine Room", open: { kind: "engine" } },
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

export function Desk({ data }: { data: DeskData }) {
  const size = useSyncExternalStore(subscribe, readSize, () => "");
  const [open, setOpen] = useState<Open>(null);
  const [zoom, setZoom] = useState(false);
  const [steam, setSteam] = useState(false);
  const time = useNewYorkTime();

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
  const monitor = l.hits.find((x) => x.id === "monitor")!.object;
  const origin = `${monitor.left + monitor.width / 2}px ${monitor.top + monitor.height * 0.4}px`;
  // The painted screen sits in the upper part of the monitor box.
  const screen: Rect = { left: monitor.left + monitor.width * 0.06, top: monitor.top + monitor.height * 0.05, width: monitor.width * 0.88, height: monitor.height * 0.62 };
  const roomy = screen.width > 200;

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-950 text-white">
      <div
        className="absolute inset-0 motion-safe:animate-[settle_900ms_ease-out]"
        style={{ transformOrigin: origin, transform: zoom ? "scale(2.4)" : "scale(1)", transition: zoom ? "transform 400ms ease-in" : undefined }}
      >
        {/* Tall phones show more height than the painting has, so a soft copy of it fills the space above. */}
        <img aria-hidden src={art(750, "webp")} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover object-top opacity-60 blur-2xl select-none" draggable={false} />
        <div aria-hidden className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent" style={{ height: l.scene.top + 40 }} />
        <picture>
          <source type="image/avif" srcSet={`${art(750, "avif")} 750w, ${art(1080, "avif")} 1080w, ${art(1170, "avif")} 1170w`} sizes="100vw" />
          <img
            src={art(1170, "webp")}
            srcSet={`${art(750, "webp")} 750w, ${art(1080, "webp")} 1080w, ${art(1170, "webp")} 1170w`}
            sizes="100vw"
            alt="Alex Ellery's corner office. A walnut desk with a monitor, keyboard and mouse, a desk calendar, a letter tray and a coffee cup, with floor-to-ceiling windows onto an autumn Hudson Valley forest"
            className="absolute select-none"
            style={px(l.scene)}
            draggable={false}
          />
        </picture>

        {/* The sleeping monitor. Nothing on it scrolls or animates. */}
        {/* Sizes use the screen's own width (cqw), so both lines scale with the painted monitor. The top line never wraps. */}
        <div className="absolute flex flex-col items-center justify-center gap-1 overflow-hidden rounded-sm text-center [container-type:inline-size]" style={px(screen)}>
          <span className="text-[clamp(0.4rem,5.6cqw,0.9rem)] whitespace-nowrap text-white/60 tabular-nums">
            {time ? `${time} in New York` : ""}
            {time && weatherLine ? ` \u00b7 ${weatherLine}` : ""}
          </span>
          <span className={`${headlineFont.className} text-[clamp(0.8rem,13cqw,1.6rem)] leading-tight font-semibold tracking-tight`}>{headline}</span>
          {roomy ? <span className="px-2 text-[0.6rem] text-white/50">{data.honesty}</span> : null}
        </div>

        {l.hits.map((t) => {
          const a = ACTIONS[t.id];
          if (!a) return null;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={a.label}
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
        <h1 className="text-base font-semibold tracking-tight">Corner Office</h1>
        <button type="button" onClick={() => go({ kind: "list" })} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-medium backdrop-blur hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-300">
          What’s on the desk
        </button>
      </header>

      <nav aria-label="Desk" className="absolute inset-x-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[env(safe-area-inset-bottom)]" style={{ top: l.dock.top, height: h - l.dock.top }}>
        <DockButton onClick={() => go({ kind: "monitor", tab: "brief" })}>Today’s brief</DockButton>
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

      <Dialog open={open?.kind === "coffee"} onClose={close} label="Coffee" className="w-[min(420px,92vw)] rounded-2xl">
        <div className="space-y-2 bg-neutral-900 p-5 text-sm text-white">
          <h2 className="text-base font-semibold">This morning’s AI</h2>
          <p>
            Screening {data.screen.items} items and writing the brief cost ${(data.receipt.costMicroUsd / 1e6).toFixed(3)} at list price.
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
                    <span className="font-medium capitalize">{id.replace("_", " ")}</span>
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
      <p className="border-t border-white/10 px-4 py-2 text-[0.7rem] text-white/50">{honesty}</p>
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
