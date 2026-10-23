// Builds one wall piece from a Midjourney export kept outside git in ../art/source. Writes a copy cut to the
// large frame's opening (scene/manifest.json, openings.frame_large) for the wall, and a full-shape copy for the
// tap view, each as AVIF and WebP under a budget. The piece's title, credit and prompt live in scene/wall.json.
// Usage: node scripts/art-wall.mjs <file in ../art/source> <id>
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [file, id] = process.argv.slice(2);
if (!file || !id) throw new Error("Usage: node scripts/art-wall.mjs <file in ../art/source> <id>");
const src = path.join("..", "art", "source", file);
const m = JSON.parse(fs.readFileSync("scene/manifest.json", "utf8"));
const o = m.openings.frame_large;
// The opening's shape in the master painting's pixels.
const ratio = ((o.x1 - o.x0) * m.source.width) / ((o.y1 - o.y0) * m.source.height);
const out = path.join("public", "art", "wall");
fs.mkdirSync(out, { recursive: true });

// [name, width, height or null to keep the piece's own shape, AVIF budget in KB]
const SIZES = [
  ["frame", 240, Math.round(240 / ratio), 25],
  ["full", 900, null, 90],
];
let over = 0;
for (const [kind, w, h, kb] of SIZES) {
  const img = sharp(src).resize(h ? { width: w, height: h, fit: "cover", position: "centre" } : { width: w });
  for (const [ext, buf, budget] of [
    ["avif", await img.clone().avif({ quality: 50, effort: 6 }).toBuffer(), kb],
    ["webp", await img.clone().webp({ quality: 74 }).toBuffer(), Math.round(kb * 1.5)],
  ]) {
    const f = path.join(out, `${id}-${kind}.${ext}`);
    fs.writeFileSync(f, buf);
    const size = Math.round(buf.length / 1024);
    if (size > budget) over++;
    console.log(`${size > budget ? "OVER" : "ok  "} ${f} ${size}KB (budget ${budget}KB)`);
  }
}
if (over) process.exit(1);
