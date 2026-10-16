// Renders the 9:16 gray-box blockout from scene/manifest.json.
// Usage: node scripts/graybox.mjs <outDir>   (writes labeled and unlabeled PNGs)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const m = JSON.parse(fs.readFileSync("scene/manifest.json", "utf8"));
const W = m.canvas.width, H = m.canvas.height;
const X = (p) => (p / 100) * W, Y = (p) => (p / 100) * H;
const vp = m.vanishing_point;
const sd = m.set_dressing;
const wall = sd.far_wall;

function rect(b, fill, extra = "") {
  return `<rect x="${X(b.x0)}" y="${Y(b.y0)}" width="${X(b.x1 - b.x0)}" height="${Y(b.y1 - b.y0)}" fill="${fill}" ${extra}/>`;
}
function poly(pts, fill) {
  return `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="${fill}"/>`;
}
function mullions(b, cols, rows, stroke = "#3a3a3a") {
  let s = "";
  for (let i = 1; i < cols; i++) { const x = b.x0 + ((b.x1 - b.x0) * i) / cols; s += `<line x1="${X(x)}" y1="${Y(b.y0)}" x2="${X(x)}" y2="${Y(b.y1)}" stroke="${stroke}" stroke-width="6"/>`; }
  for (let j = 1; j < rows; j++) { const y = b.y0 + ((b.y1 - b.y0) * j) / rows; s += `<line x1="${X(b.x0)}" y1="${Y(y)}" x2="${X(b.x1)}" y2="${Y(y)}" stroke="${stroke}" stroke-width="6"/>`; }
  return s + rect(b, "none", `stroke="${stroke}" stroke-width="10"`);
}

function svg(labeled) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  // Room shell in one-point perspective
  s += rect({ x0: 0, x1: 100, y0: 0, y1: 100 }, "#8f8f8f");
  s += poly([[0, 0], [100, 0], [wall.x1, wall.y0], [wall.x0, wall.y0]], "#b9b9b9"); // ceiling
  s += poly([[0, 0], [wall.x0, wall.y0], [wall.x0, wall.y1], [0, 70]], "#7d7d7d"); // left wall
  s += rect(wall, "#a6a6a6"); // far wall
  s += poly([[wall.x1, wall.y0], [100, 0], [100, 70], [wall.x1, wall.y1]], "#9a9a9a"); // right wall
  // Glass runs, door, side windows
  s += rect(sd.glass_left_run, "#d3d8dc") + mullions(sd.glass_left_run, 3, 2);
  s += rect(sd.interior_wall_right, "#b3aa9e"); // interior wall: the door leads to a hallway, not outside
  s += rect(sd.door, "#e3d6c4") + mullions(sd.door, 1, 1);
  s += poly([[88.6, 18], [99.5, 6], [99.5, 64], [88.6, 54]], "#9a948c"); // interior side wall
  // Desk in perspective, then its front edge
  s += poly([[6, 60], [94, 60], [100, 74], [100, 88], [0, 88], [0, 74]], "#6f6f6f");
  s += rect(sd.desk_front, "#4f4f4f");
  // Objects
  const shade = { monitor: "#2b2b2b", frame_large: "#c9c9c9", frame_small: "#c9c9c9", drawer_pull: "#2f2f2f" };
  for (const o of m.objects) {
    if (o.id === "monitor") {
      s += rect(o.stand, "#5a5a5a");
      s += rect({ x0: o.x0, x1: o.x1, y0: o.y0, y1: 62 }, "#1f1f1f");
      s += rect(o.screen, "#2b2b2b");
    } else {
      s += rect(o, shade[o.id] ?? "#bdbdbd", 'rx="10"');
    }
    if (labeled) {
      s += rect(o, "none", 'stroke="#d24" stroke-width="4" stroke-dasharray="14 8"');
      s += `<text x="${X((o.x0 + o.x1) / 2)}" y="${Y((o.y0 + o.y1) / 2) + 12}" font-family="Helvetica" font-size="34" text-anchor="middle" fill="#d24">${o.id.replace("_", " ")}</text>`;
    }
  }
  if (labeled) {
    const z = m.zones;
    s += rect(z.safe_frame, "none", 'stroke="#27f" stroke-width="5" stroke-dasharray="20 10"');
    s += rect(z.dock_band, "#27f", 'fill-opacity="0.18"');
    s += `<line x1="0" y1="${Y(25)}" x2="${W}" y2="${Y(25)}" stroke="#27f" stroke-width="3" stroke-dasharray="6 8"/>`;
    s += `<text x="${X(50)}" y="${Y(10)}" font-family="Helvetica" font-size="38" text-anchor="middle" fill="#27f">ceiling, croppable (top 25%)</text>`;
    s += `<text x="${X(50)}" y="${Y(97)}" font-family="Helvetica" font-size="36" text-anchor="middle" fill="#27f">dock band, nothing live</text>`;
    s += rect(sd.door.future_live, "none", 'stroke="#2a2" stroke-width="4" stroke-dasharray="10 6"');
    s += `<text x="${X(66.5)}" y="${Y(34)}" font-family="Helvetica" font-size="30" text-anchor="middle" fill="#2a2">door</text>`;
  }
  return s + "</svg>";
}

const out = process.argv[2] ?? ".";
fs.mkdirSync(out, { recursive: true });
for (const [name, labeled] of [["graybox-v2-upload.png", false], ["graybox-v2-labeled.png", true]]) {
  await sharp(Buffer.from(svg(labeled))).png().toFile(path.join(out, name));
  console.log("wrote", path.join(out, name));
}
