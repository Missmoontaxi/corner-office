// Makes Paula's owner secret and link. The secret goes into .env.local and the full link into .owner-link, both
// outside git. Nothing secret is printed, so it never lands in a terminal log or a chat.
// Usage: pnpm owner:link      (reuses the secret if one exists, so the link stays the same)
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const ENV = ".env.local";
const env = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
let secret = env.match(/^OWNER_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  secret = randomBytes(32).toString("base64url");
  fs.appendFileSync(ENV, `${env.endsWith("\n") || !env ? "" : "\n"}OWNER_SECRET=${secret}\n`);
  console.log(`Added OWNER_SECRET to ${ENV} (${secret.length} characters).`);
} else console.log(`OWNER_SECRET already in ${ENV} (${secret.length} characters).`);
fs.writeFileSync(".owner-link", `https://lab.moontaxilab.com/owner/${secret}\n`, { mode: 0o600 });
console.log("Your owner link is in code/.owner-link. Open it on your phone once to unlock Run it live.");
