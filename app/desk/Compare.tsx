"use client";

import type { DeskData } from "@/lib/desk/data";
import { modelName, plainDay, twelveHour } from "@/lib/desk/shared";
import { headlineFont } from "../fonts";

type Side = DeskData["compare"][number];

const usd = (micro: number) => `$${(micro / 1e6).toFixed(3)}`;
const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
// The word count the code check measured, such as "241 words, limit 250 plus 5".
const words = (s: Side) => s.checks.words?.detail.match(/^(\d+) words/)?.[1] ?? "?";
const passed = (s: Side) => Object.values(s.checks).filter((c) => c.passed).length;
// The maker's short name for a column heading, such as "Sonnet 5.5".
const shortName = (id: string) => modelName(id).replace(/ from \w+$/, "").replace(/^Claude /, "");

const CHECKS: { key: string; plain: string }[] = [
  { key: "numbers", plain: "Every figure appears in the material" },
  { key: "words", plain: "Under the word limit" },
  { key: "attack", plain: "The planted attack is flagged and its address appears nowhere" },
];

// The same morning through two models. The strip on top holds what code measures the same way for every model,
// so it reads as a fair comparison. The briefs sit side by side on wider screens and stack on phones.
export function CompareView({ data }: { data: DeskData }) {
  const sides = data.compare;
  if (sides.length < 2) return <p className="text-sm text-white/70">Compare needs a second model&apos;s brief, and none is recorded yet.</p>;
  const [prod, ...rest] = sides as [Side, ...Side[]];
  const rows: [string, (s: Side) => string][] = [
    ["Cost at list price", (s) => usd(s.receipt.costMicroUsd)],
    ["Time to write", (s) => `${(s.receipt.latencyMs.total / 1000).toFixed(0)} seconds`],
    ["Words", words],
    ["Code checks passed", (s) => `${passed(s)} of ${Object.keys(s.checks).length}`],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/75">
        The same morning, the same screened material, the same instructions. {modelName(prod.receipt.route.model)} writes Alex&apos;s brief, and{" "}
        {rest.map((s) => modelName(s.receipt.route.model)).join(" and ")} is its backup. Both were written ahead of time, so nothing runs while you read.
      </p>

      <div className="sticky -top-4 z-10 -mx-4 bg-neutral-900/95 px-4 py-2 backdrop-blur">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Measured by code, the same way for both models</caption>
          <thead>
            <tr className="text-xs text-white/60">
              <th scope="col" className="w-[38%] py-1 font-normal">
                <span className="sr-only">Measure</span>
              </th>
              {sides.map((s, i) => (
                <th key={i} scope="col" className="py-1 font-semibold text-white">
                  {shortName(s.receipt.route.model)}
                  <span className="block text-[0.65rem] font-normal text-white/50">{i === 0 ? "In production" : "Backup"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="py-1 pr-2 text-xs font-normal text-white/60">
                  {label}
                </th>
                {sides.map((s, i) => (
                  <td key={i} className="py-1 font-medium tabular-nums">
                    {value(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map((s, i) => (
          <BriefCard key={i} side={s} role={i === 0 ? "In production" : "Backup"} />
        ))}
      </div>

      <p className="text-xs text-white/50">
        Which headline is right is a judgment call, so the Engine Room&apos;s scorecard grades that part against PM&apos;s rubric, naming the judge for each line. The numbers above are measured by code and need no judge.
      </p>
    </div>
  );
}

function BriefCard({ side, role }: { side: Side; role: string }) {
  const b = side.brief;
  return (
    <article aria-label={`${modelName(side.receipt.route.model)}, ${role}`} className="min-w-0 space-y-3 rounded-xl bg-white/[0.06] p-4 text-sm">
      <header>
        <p className="font-semibold">{modelName(side.receipt.route.model)}</p>
        <p className="text-xs text-white/50">
          {role}. Written {nyTime(side.receipt.runAt)} New York time.
        </p>
      </header>

      <section aria-label="Headline" className="rounded-lg bg-gradient-to-br from-amber-200/[0.14] to-white/[0.04] p-3 ring-1 ring-amber-200/20">
        <h3 className={`${headlineFont.className} text-lg leading-snug font-semibold text-balance`}>{b.headline.title.replace(/\*\*/g, "")}</h3>
        <p className="mt-1 text-white/75">{b.headline.context}</p>
        <p className="mt-2 font-medium text-amber-100">
          <span className="text-[0.65rem] font-semibold tracking-wide text-amber-200/80 uppercase">Next step </span>
          {b.headline.action}
        </p>
      </section>

      <section aria-label="Top priorities">
        <h4 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Top priorities</h4>
        <ol className="list-decimal space-y-1.5 pl-5">
          {b.priorities.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.title}</span>
              <span className="block text-white/60">{p.next_step}</span>
            </li>
          ))}
        </ol>
      </section>

      {b.decisions.length ? (
        <section aria-label="Decisions">
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Decisions</h4>
          <ul className="space-y-1.5">
            {b.decisions.map((d, i) => (
              <li key={i}>
                {d.question} <span className="text-white/50">Due {twelveHour(plainDay(d.due))}.</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Code checks">
        <h4 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Code checks</h4>
        <ul className="space-y-1">
          {CHECKS.filter((c) => side.checks[c.key]).map((c) => {
            const ok = side.checks[c.key]!.passed;
            return (
              <li key={c.key} className="flex gap-2">
                <span aria-hidden className={ok ? "text-emerald-300" : "text-rose-300"}>
                  {ok ? "✓" : "✗"}
                </span>
                <span>
                  <span className="sr-only">{ok ? "Passed. " : "Failed. "}</span>
                  {c.plain}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}
