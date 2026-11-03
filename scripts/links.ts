// Personal links. Paula mints each one herself. The full link goes into .personal-links, outside git, and is
// never printed, so it stays out of terminal logs and chats.
// Usage:
//   pnpm link:secret                                       adds LINK_SECRET to .env.local (copy it to Vercel yourself)
//   pnpm link:create --name Sam --tier vip --lens founder [--label "private note"] [--view city|country]
//   pnpm link:list
//   pnpm link:revoke <id>
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createLink, isOpen, listLinks, mintRoom, revokeLink, runsLeft } from "../lib/live/links";

const ENV = ".env.local";
const FILE = ".personal-links";
const BASE = "https://lab.moontaxilab.com/l/";
const usd = (m: number) => `$${(m / 1e6).toFixed(2)}`;
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "America/New_York" });

function flag(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "secret") {
    const env = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
    const have = env.match(/^LINK_SECRET=(.+)$/m)?.[1]?.trim();
    if (have) return console.log(`LINK_SECRET already in ${ENV} (${have.length} characters).`);
    const s = randomBytes(32).toString("base64url");
    fs.appendFileSync(ENV, `${env.endsWith("\n") || !env ? "" : "\n"}LINK_SECRET=${s}\n`);
    return console.log(`Added LINK_SECRET to ${ENV} (${s.length} characters). Copy it into Vercel as a Sensitive Production variable.`);
  }
  if (cmd === "create") {
    const name = flag("name");
    const tier = flag("tier") ?? "standard";
    const lens = flag("lens") ?? "founder";
    const view = flag("view");
    if (!name || !["standard", "vip"].includes(tier) || !["founder", "enterprise"].includes(lens) || (view && !["city", "country"].includes(view)))
      throw new Error('Usage: pnpm link:create --name Sam --tier standard|vip --lens founder|enterprise [--label "note"] [--view city|country]');
    const r = await createLink({ name, label: flag("label") ?? "", tier: tier as "standard" | "vip", lens: lens as "founder" | "enterprise", view: view as "city" | "country" | undefined });
    if (!r.ok) throw new Error(`Not minted. Only ${usd(r.room)} of the monthly visitor cap is free for new envelopes.`);
    fs.appendFileSync(FILE, `${r.link.id}\t${name}\t${tier}\t${day(r.link.expires)}\t${BASE}${r.token}\n`, { mode: 0o600 });
    return console.log(`Minted ${r.link.id} for ${name}, ${tier}, ${lens}, until ${day(r.link.expires)}. The link is in code/${FILE}. ${usd(r.room)} of the cap is still free.`);
  }
  if (cmd === "list") {
    const links = await listLinks();
    for (const l of links)
      console.log(`${l.id}  ${l.name.padEnd(12)} ${l.tier.padEnd(8)} ${l.revoked ? "revoked" : isOpen(l) ? `${runsLeft(l)} runs left` : "expired"}, spent ${usd(l.spent)} of ${usd(l.envelope)}, until ${day(l.expires)}${l.label ? `, ${l.label}` : ""}`);
    return console.log(`${links.length} links. ${usd(await mintRoom())} of the monthly visitor cap is free.`);
  }
  if (cmd === "revoke") {
    const id = process.argv[3];
    if (!id) throw new Error("Usage: pnpm link:revoke <id>");
    if (!(await revokeLink(id))) throw new Error(`No link ${id}.`);
    return console.log(`Revoked ${id}. Its unspent envelope goes back to the cap.`);
  }
  throw new Error("Usage: pnpm link:secret | link:create | link:list | link:revoke <id>");
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
