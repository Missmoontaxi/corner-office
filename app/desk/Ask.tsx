"use client";

import { useState } from "react";
import type { DeskData } from "@/lib/desk/data";
import { plainDay } from "@/lib/desk/shared";
import { ReceiptSheet } from "./Brief";

// The keyboard's six prompt keys. Each answer was written once, ahead of time, so a tap is instant and free.
export function AskView({ data }: { data: DeskData }) {
  const [open, setOpen] = useState<number | null>(null);
  const [receipt, setReceipt] = useState(false);
  const a = data.asks.find((x) => x.key === open);

  if (a && receipt)
    return <ReceiptSheet data={data} section="this answer" receipt={a.receipt} checks={a.checks} backLabel="Back to the answer" onBack={() => setReceipt(false)} />;

  if (a)
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpen(null)} className="min-h-11 rounded-full px-3 text-sm font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
          <span aria-hidden>‹ </span>
          Back to the Questions
        </button>
        <section className="rounded-xl bg-white/[0.06] p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-lg leading-snug font-semibold">{a.question}</h2>
            <button type="button" onClick={() => setReceipt(true)} className="min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
              How?
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {a.answer.lines.map((l, i) => (
              <li key={i}>
                {plainDay(l.text)}
                <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                  {l.source_ids.map((id) => (
                    <abbr key={id} title={data.sources[id] ?? id} className="rounded bg-white/10 px-1 text-[0.65rem] text-white/60 no-underline">
                      {id}
                    </abbr>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {a.answer.flagged.length ? (
            <p className="mt-3 text-xs text-white/60">
              {(() => {
                const n = a.answer.flagged.filter((f) => f.kind === "suspicious").length;
                return n ? `${n} item${n === 1 ? "" : "s"} flagged, not followed. ` : "";
              })()}
              {a.answer.flagged
                .filter((f) => f.kind === "verify")
                .map((f) => f.reason)
                .join(" ")}
            </p>
          ) : null}
        </section>
        <p className="text-xs text-white/50">
          Answered ahead of time by {a.receipt.route.model} for ${(a.receipt.costMicroUsd / 1e6).toFixed(3)}. Your cost $0.00.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/60">Six questions to answer each morning.</p>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.asks.map((k) => (
          <li key={k.key}>
            <button
              type="button"
              onClick={() => setOpen(k.key)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3 text-left text-sm font-medium hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-sky-300"
            >
              <kbd className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/25 bg-black/30 font-mono text-xs">{k.key}</kbd>
              {k.question}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
