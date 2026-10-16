// Renders the 16:9 wide gray-box (v2: glass corner on the left, interior wall and door on the right) from scene/graybox-manifest.json. The center 9:16 strip is the phone view:
// every live object, the door and the frames sit there at the same canvas positions as the portrait,
// so a painting of the wide view crops straight to the phone master.
// Usage: node scripts/graybox-wide.mjs <outDir>   (writes labeled and unlabeled PNGs)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const m = JSON.parse(fs.readFileSync("scene/graybox-manifest.json", "utf8"));
const W = m.canvas.width, H = m.canvas.height;
const WW = Math.round((H * 16) / 9);
const OX = (WW - W) / 2;
// Percent of the portrait strip, so the strip's coordinates match the manifest. Side panels run past 0 and 100.
const X = (p) => OX + (p / 100) * W, Y = (p) => (p / 100) * H;
const L = -OX / W * 100, R = 100 + OX / W * 100;
const sd = m.set_dressing;
const wall = sd.far_wall;
const FAR_LEFT = -60;

const rect = (b, fill, extra = "") =>
  `<rect x="${X(b.x0)}" y="${Y(b.y0)}" width="${(W * (b.x1 - b.x0)) / 100}" height="${Y(b.y1 - b.y0)}" fill="${fill}" ${extra}/>`;
const poly = (pts, fill) => `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="${fill}"/>`;
const line = (x1, y1, x2, y2, w = 6) => `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="#3a3a3a" stroke-width="${w}"/>`;
function mullions(b, cols, rows) {
  let s = "";
  for (let i = 1; i < cols; i++) { const x = b.x0 + ((b.x1 - b.x0) * i) / cols; s += line(x, b.y0, x, b.y1); }
  for (let j = 1; j < rows; j++) { const y = b.y0 + ((b.y1 - b.y0) * j) / rows; s += line(b.x0, y, b.x1, y); }
  return s + rect(b, "none", 'stroke="#3a3a3a" stroke-width="10"');
}
// The right glass wall's top and bottom edges, continued from the portrait's side windows toward the viewer.
const rTop = (x) => 18 + ((x - 88.6) * (6 - 18)) / (99.5 - 88.6);
const rBot = (x) => 54 + ((x - 88.6) * (64 - 54)) / (99.5 - 88.6);
// The left side wall's edges, drawn from the vanishing point through the far wall's new left corners.
const vp = m.vanishing_point;
const lEdge = (y) => vp.y + ((y - vp.y) * (L - vp.x)) / (FAR_LEFT - vp.x);

function svg(labeled) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${WW}" height="${H}" viewBox="0 0 ${WW} ${H}">`;
  s += `<rect x="0" y="0" width="${WW}" height="${H}" fill="#b9b9b9"/>`; // ceiling
  s += poly([[L, wall.y1], [R, wall.y1], [R, 100], [L, 100]], "#858585"); // floor
  s += rect({ x0: FAR_LEFT, x1: wall.x1, y0: wall.y0, y1: wall.y1 }, "#a6a6a6"); // far wall, widened
  // Left side wall is glass: the corner of the corner office
  s += poly([[L, lEdge(wall.y0)], [FAR_LEFT, wall.y0], [FAR_LEFT, wall.y1], [L, lEdge(wall.y1)]], "#cdd2d6");
  for (const x of [-70, -82, -96]) s += line(x, lEdge(wall.y0) + ((wall.y0 - lEdge(wall.y0)) * (x - L)) / (FAR_LEFT - L), x, lEdge(wall.y1) + ((wall.y1 - lEdge(wall.y1)) * (x - L)) / (FAR_LEFT - L));
  // Glass: the portrait's two runs and door, plus a new run on the widened far wall
  const leftRun = { x0: -55, x1: -5, y0: 21, y1: 52 };
  s += rect(leftRun, "#d3d8dc") + mullions(leftRun, 4, 2);
  s += rect(sd.glass_left_run, "#d3d8dc") + mullions(sd.glass_left_run, 3, 2);
  s += rect(sd.interior_wall_right, "#b3aa9e"); // interior wall beside the door
  s += rect(sd.door, "#e3d6c4") + mullions(sd.door, 1, 1);
  // Right side wall is interior, so the door reads as leading to a hallway, not outside
  s += poly([[88.6, rTop(88.6)], [R, rTop(R)], [R, rBot(R)], [88.6, rBot(88.6)]], "#9a948c");
  // Desk, a little wider than the strip so it does not end at the crop line
  s += poly([[6, 60], [94, 60], [108, 88], [-8, 88]], "#6f6f6f");
  s += rect({ x0: -8, x1: 108, y0: 88, y1: 100 }, "#4f4f4f");
  const shade = { monitor: "#2b2b2b", frame_large: "#c9c9c9", frame_small: "#c9c9c9", drawer_pull: "#2f2f2f" };
  for (const o of m.objects) {
    if (o.id === "monitor") {
      s += rect(o.stand, "#5a5a5a") + rect({ x0: o.x0, x1: o.x1, y0: o.y0, y1: 62 }, "#1f1f1f") + rect(o.screen, "#2b2b2b");
    } else {
      s += rect(o, shade[o.id] ?? "#bdbdbd", 'rx="10"');
    }
    if (labeled) {
      s += rect(o, "none", 'stroke="#d24" stroke-width="4" stroke-dasharray="14 8"');
      s += `<text x="${X((o.x0 + o.x1) / 2)}" y="${Y((o.y0 + o.y1) / 2) + 12}" font-family="Helvetica" font-size="34" text-anchor="middle" fill="#d24">${o.id.replace("_", " ")}</text>`;
    }
  }
  if (labeled) {
    s += rect({ x0: 0, x1: 100, y0: 0, y1: 100 }, "none", 'stroke="#27f" stroke-width="8" stroke-dasharray="30 14"');
    s += `<text x="${X(50)}" y="${Y(6)}" font-family="Helvetica" font-size="44" text-anchor="middle" fill="#27f">phone crop: everything live stays inside this strip</text>`;
    s += rect(sd.door.future_live, "none", 'stroke="#2a2" stroke-width="4" stroke-dasharray="10 6"');
    s += `<text x="${X(66.5)}" y="${Y(34)}" font-family="Helvetica" font-size="30" text-anchor="middle" fill="#2a2">door</text>`;
  }
  return s + "</svg>";
}

const out = process.argv[2] ?? ".";
fs.mkdirSync(out, { recursive: true });
for (const [name, labeled] of [["graybox-wide-v2-upload.png", false], ["graybox-wide-v2-labeled.png", true]]) {
  await sharp(Buffer.from(svg(labeled))).png().toFile(path.join(out, name));
  console.log("wrote", path.join(out, name), `${WW}x${H}, phone strip x ${OX} to ${OX + W}`);
}
