// Builds the optimized phone scene from Paula's master painting (kept outside git in ../art/source).
// Crops the phone view, repeats the desk front edge in a band under it for the dock, and writes AVIF and WebP
// at each width. Fails if any file is over its budget, so an unoptimized upscale can never ship.
// Usage: node scripts/art-build.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const m = JSON.parse(fs.readFileSync("scene/manifest.json", "utf8"));
const src = path.join("..", "art", "source", m.source.file);
const out = path.join("public", "art");
// Budgets from the Desk Addendum, in KB. WebP is the fallback and gets 1.5 times the AVIF budget.
const AVIF_BUDGET = { 750: 60, 1080: 100, 1170: 120 };

const { width: W, height: H } = await sharp(src).metadata();
if (W !== m.source.width || H !== m.source.height) throw new Error(`${src} is ${W}x${H}, manifest says ${m.source.width}x${m.source.height}`);

const left = Math.round((m.phone.crop_x0 / 100) * W);
const cropW = Math.round(((m.phone.crop_x1 - m.phone.crop_x0) / 100) * W);
const phone = await sharp(src)
  .extract({ left, top: 0, width: cropW, height: H })
  .extend({ bottom: m.phone.extend_bottom_px, extendWith: "copy" })
  .toBuffer();

fs.mkdirSync(out, { recursive: true });
let over = 0;
for (const [w, kb] of Object.entries(AVIF_BUDGET)) {
  const resized = sharp(phone).resize({ width: Number(w) });
  for (const [ext, buf, budget] of [
    ["avif", await resized.clone().avif({ quality: 50, effort: 6 }).toBuffer(), kb],
    ["webp", await resized.clone().webp({ quality: 72 }).toBuffer(), Math.round(kb * 1.5)],
  ]) {
    const file = path.join(out, `office-phone-${m.version}-${w}.${ext}`);
    fs.writeFileSync(file, buf);
    const size = Math.round(buf.length / 1024);
    const ok = size <= budget;
    if (!ok) over++;
    console.log(`${ok ? "ok  " : "OVER"} ${file} ${size}KB (budget ${budget}KB)`);
  }
}
if (over) {
  console.error(`${over} file(s) over budget`);
  process.exit(1);
}
