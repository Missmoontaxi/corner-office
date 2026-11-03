// Writes Paula's labeling page from the blind set: each output with its case's expectations, her judged criteria
// in her words, and pass or fail buttons. Labels save in the browser as she goes, and "Download labels.csv" gives
// rows for her Labels tab. The page never shows which model or variant wrote an output.
// Usage: pnpm eval:labeling-page, then open evals/results/local/labeling.html
import fs from "node:fs";
import path from "node:path";
import type { BriefV1 } from "../lib/engine/contracts";
import { briefText } from "../lib/engine/brief";
import { DIGEST, loadCases, loadRubric } from "../evals/lib";

type Output = { output_id: string; half: string; case_id: string; brief: BriefV1 };
const outputs: Output[] = JSON.parse(fs.readFileSync(path.join(DIGEST, "labeling", "outputs.json"), "utf8"));
const template = fs.readFileSync(path.join(DIGEST, "labeling", "labels-template.csv"), "utf8");
const labeled = [...new Set(template.trim().split("\n").slice(1).map((l) => l.split(",")[2]!.replaceAll('"', "")))];
const rubric = loadRubric().filter((c) => labeled.includes(c.id));
const cases = Object.fromEntries(loadCases().map((c) => [c.case_id, c]));
const sheet = (id: string) => {
  const f = path.join(DIGEST, "days", `${id}.md`);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="none">None</p>`);

function brief(b: BriefV1) {
  const words = briefText(b).split(/\s+/).filter(Boolean).length;
  return `
  <p class="meta">${esc(b.date.label)}${b.date.weather ? ` · ${esc(b.date.weather)}` : ""}${b.date.observances.length ? ` · ${esc(b.date.observances.join(", "))}` : ""} · ${words} words</p>
  <h3>${esc(b.headline.title)}</h3><p>${esc(b.headline.context)}</p><p><b>Action</b> ${esc(b.headline.action)}</p>
  <h4>Priorities</h4>${list(b.priorities.map((p) => `${p.title}. ${p.why} Next, ${p.next_step}`))}
  <h4>Decisions</h4>${list(b.decisions.map((d) => `${d.question} (${d.owner}, ${d.due})${d.carried_over ? " [carried over]" : ""}`))}
  <h4>Calendar</h4>${list(b.calendar.map((c) => `[${c.kind}] ${c.line}`))}
  <h4>Business health</h4>${list(b.business_health.map((h) => `[${h.status}] ${h.line}`))}
  <h4>Personal</h4>${list(b.personal.map((p) => p.line))}
  <h4>Flagged</h4>${list(b.flagged.map((f) => `[${f.kind}] ${f.reason}`))}`;
}

function card(o: Output) {
  const c = cases[o.case_id]!;
  const crit = rubric
    .map(
      (r) => `<div class="crit" data-o="${o.output_id}" data-c="${r.id}">
      <div><b>${r.id}</b> ${esc(r.criterion)}<details><summary>Pass if, fail if</summary><p>Pass if ${esc(r.pass_if)}</p><p>Fail if ${esc(r.fail_if)}</p></details></div>
      <div class="btns"><button data-v="pass">Pass</button><button data-v="fail">Fail</button></div>
      <input class="note" placeholder="Note (optional)"></div>`,
    )
    .join("");
  return `<section class="out" id="${o.output_id}">
  <h2>${o.output_id} <span class="case">${o.case_id}, ${esc(c.day)}, ${esc(c.scenario)}</span></h2>
  <details class="exp"><summary>What this case expects</summary>
    <p><b>Top three</b></p>${list(c.top_3_priorities)}
    <p><b>Decisions needed</b></p>${list(c.decisions_needed)}
    <p><b>Must not say</b></p>${list(c.must_not_say)}
    <p><b>Word limit</b> ${c.max_words}</p>${c.judge_notes ? `<p><b>Judge notes</b> ${esc(c.judge_notes)}</p>` : ""}
    <details><summary>Day sheet</summary><pre>${esc(sheet(o.case_id))}</pre></details>
  </details>
  <div class="brief">${brief(o.brief)}</div>
  <div class="crits">${crit}</div>
</section>`;
}

const halves = ["tuning", "held-out"].map((h) => outputs.filter((o) => o.half === h));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Labeling set</title><style>
:root{--bg:#faf8f4;--fg:#1e1d1a;--mut:#6b675e;--line:#e2ddd2;--card:#fff;--pass:#2f7a4a;--fail:#b3402f}
@media (prefers-color-scheme:dark){:root{--bg:#171614;--fg:#ece8df;--mut:#a29d92;--line:#33302b;--card:#201f1c;--pass:#5cb37d;--fail:#e07a66}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:1}
.out{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
.case,.meta,.none{color:var(--mut);font-weight:400;font-size:14px}
.brief{border-left:3px solid var(--line);padding-left:12px;margin:12px 0}
h3{margin:4px 0}h4{margin:12px 0 2px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
ul{margin:2px 0;padding-left:20px}pre{white-space:pre-wrap;font-size:13px}
.crit{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:8px 0;border-top:1px solid var(--line)}
.crit .note{grid-column:1/-1;font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:transparent;color:inherit}
.btns button{font:inherit;padding:4px 12px;border:1px solid var(--line);border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.btns button.on[data-v=pass]{background:var(--pass);color:#fff;border-color:var(--pass)}
.btns button.on[data-v=fail]{background:var(--fail);color:#fff;border-color:var(--fail)}
.half{margin-top:32px}#dl{font:inherit;padding:6px 12px;cursor:pointer}
</style></head><body>
<header><b>Labeling set</b><span id="count"></span><button id="dl">Download labels.csv</button></header>
<main>
<p>Label each output pass or fail on each criterion. Do the tuning half first, then the held-out half. Labels save in this browser as you go. When you finish, download labels.csv and paste its rows into the Labels tab.</p>
<h2 class="half">Tuning half (T01 to T20)</h2>${halves[0]!.map(card).join("")}
<h2 class="half">Held-out half (H01 to H20)</h2>${halves[1]!.map(card).join("")}
</main>
<script>
const KEY="labeling-2026-11-02";const cases=${JSON.stringify(Object.fromEntries(outputs.map((o) => [o.output_id, o.case_id])))};
let s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}count()};
const total=document.querySelectorAll(".crit").length;
function count(){const n=Object.values(s).filter(v=>v.label).length;document.getElementById("count").textContent=n+" of "+total+" labeled"}
document.querySelectorAll(".crit").forEach(el=>{
  const k=el.dataset.o+"|"+el.dataset.c,note=el.querySelector(".note"),bs=el.querySelectorAll("button");
  const paint=()=>bs.forEach(b=>b.classList.toggle("on",s[k]?.label===b.dataset.v));
  note.value=s[k]?.notes||"";paint();
  bs.forEach(b=>b.onclick=()=>{s[k]={...s[k],label:s[k]?.label===b.dataset.v?"":b.dataset.v};paint();save()});
  note.oninput=()=>{s[k]={...s[k],notes:note.value};save()};
});
document.getElementById("dl").onclick=()=>{
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const rows=[...document.querySelectorAll(".crit")].map(el=>{const k=el.dataset.o+"|"+el.dataset.c;return [el.dataset.o,cases[el.dataset.o],el.dataset.c,s[k]?.label,s[k]?.notes].map(q).join(",")});
  const blob=new Blob([['"output_id","case_id","criterion_id","label","notes"',...rows].join("\\n")+"\\n"],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="labels.csv";a.click();
};
count();
</script></body></html>`;

const out = path.join("evals", "results", "local", "labeling.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${outputs.length} outputs, ${rubric.length} criteria each. Open ${out}`);
