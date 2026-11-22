// Panier futé - weekly robot (runs on GitHub Actions, free).
// 1) Reads this week's flyers (Flipp) for our 7 stores and saves them in data/flyers/<thursday>.json
// 2) With --backfill N: saves the weekly Noovo Moi flyer article of the past N weeks in data/noovo/<thursday>.txt
// No AI key needed here: the app turns these files into specials (and uses its own AI only without web search).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Flipp = require(path.join(ROOT, "flipp.js"));
// Regions kept every week (Montreal in data/flyers/, the others in data/flyers/<id>/). Same list as REGIONS in app.js.
const REGIONS = [
  { id: "", name: "Montréal", postal: process.env.POSTAL || "H2X1Y4" },
  { id: "st-hyacinthe", name: "Saint-Hyacinthe", postal: "J2S1A1" },
  { id: "drummondville", name: "Drummondville", postal: "J2B1A1" },
  { id: "st-liboire", name: "Saint-Liboire", postal: "J0H1R0" },
];
const args = process.argv.slice(2);
const backfill = Number((args.find((a) => a.startsWith("--backfill=")) || "").split("=")[1] || 0);
const force = args.includes("--force");

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(new Date(s + "T12:00:00Z").getTime() + n * 864e5));
function weekKey(d = new Date()) { // Thursday of the flyer week (Thursday -> Wednesday), Montreal time
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const back = (local.getDay() + 3) % 7; // Thu=0, Fri=1, ... Wed=6
  local.setDate(local.getDate() - back);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
const write = (rel, data) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return null; } };

async function flyers(reg) {
  const dir = "data/flyers/" + (reg.id ? reg.id + "/" : "");
  const debut = weekKey(), file = `${dir}${debut}.json`;
  const old = read(file);
  if (old && !force && JSON.parse(old).raw.length >= 80) { console.log(`${file} already done`); return; }
  const raw = await Flipp.collect(reg.postal, debut, { pause: 250, progress: (n, t) => { if (n % 40 === 0) console.log(`${reg.name} ${n}/${t}`); } });
  console.log(`${reg.name}: ${raw.length} flyer items for the week of ${debut}`);
  if (raw.length < 20) { console.log("Too few items: the new flyers are probably not online yet."); return; }
  const fin = addDays(debut, 6);
  write(file, JSON.stringify({ debut, fin, made: new Date().toISOString(), region: reg.name, postal: reg.postal.slice(0, 3), source: "Circulaires Flipp", raw }));
  const idx = JSON.parse(read(`${dir}index.json`) || "[]").filter((w) => w !== debut).concat(debut).sort().slice(-60);
  write(`${dir}index.json`, JSON.stringify(idx));
}

// ---------- past year: Noovo Moi weekly article "circulaires-epicerie-19-au-25-novembre-2026" ----------
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
function slugs(debut) {
  const a = new Date(debut + "T12:00:00Z"), b = new Date(a.getTime() + 6 * 864e5);
  const da = a.getUTCDate(), db = b.getUTCDate(), ma = MOIS[a.getUTCMonth()], mb = MOIS[b.getUTCMonth()], ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
  const d1 = da === 1 ? ["1er", "1"] : [String(da)], d2 = db === 1 ? ["1er", "1"] : [String(db)];
  const out = [];
  for (const x of d1) for (const y of d2) {
    if (ma === mb) out.push(`circulaires-epicerie-${x}-au-${y}-${mb}-${yb}`);
    else if (ya === yb) out.push(`circulaires-epicerie-${x}-${ma}-au-${y}-${mb}-${yb}`);
    else out.push(`circulaires-epicerie-${x}-${ma}-${ya}-au-${y}-${mb}-${yb}`, `circulaires-epicerie-${x}-${ma}-au-${y}-${mb}-${yb}`);
  }
  return out;
}
function textOf(html) {
  const art = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
  return art.replace(/<(script|style|noscript|svg|figure|aside|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h\d|li|div|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
async function noovo(n) {
  const now = weekKey(), done = JSON.parse(read("data/noovo/index.json") || "[]");
  for (let k = 1; k <= n; k++) {
    const debut = addDays(now, -7 * k);
    if (done.includes(debut)) continue;
    let ok = false;
    for (const s of slugs(debut)) {
      for (const host of ["https://www.noovomoi.ca", "https://noovomoi.ca"]) {
        const url = `${host}/cuisiner/trucs-inspirations/article/${s}/`;
        try {
          const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (PanierFute robot)" } });
          if (!r.ok) continue;
          const t = textOf(await r.text());
          if (t.length < 800 || !/\$/.test(t)) continue;
          write(`data/noovo/${debut}.txt`, `SOURCE: ${url}\nSEMAINE: ${debut} au ${addDays(debut, 6)}\n\n` + t.slice(0, 40000));
          done.push(debut); ok = true; console.log(`noovo ${debut} ok`);
          break;
        } catch (e) { /* try the next address */ }
      }
      if (ok) break;
      await new Promise((res) => setTimeout(res, 400));
    }
    if (!ok) console.log(`noovo ${debut}: not found`);
  }
  write("data/noovo/index.json", JSON.stringify([...new Set(done)].sort()));
}

for (const reg of REGIONS) { try { await flyers(reg); } catch (e) { console.log(`${reg.name}: ${e.message}`); } }
if (backfill) await noovo(backfill);
// Panier futé - weekly robot (runs on GitHub Actions, free).
// 1) Reads this week's flyers (Flipp) for our 7 stores and saves them in data/flyers/<thursday>.json
// 2) With --backfill N: saves the weekly Noovo Moi flyer article of the past N weeks in data/noovo/<thursday>.txt
// No AI key needed here: the app turns these files into specials (and uses its own AI only without web search).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Flipp = require(path.join(ROOT, "flipp.js"));
const POSTAL = process.env.POSTAL || "H2X1Y4";
const args = process.argv.slice(2);
const backfill = Number((args.find((a) => a.startsWith("--backfill=")) || "").split("=")[1] || 0);
const force = args.includes("--force");

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(new Date(s + "T12:00:00Z").getTime() + n * 864e5));
function weekKey(d = new Date()) { // Thursday of the flyer week (Thursday -> Wednesday), Montreal time
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const back = (local.getDay() + 3) % 7; // Thu=0, Fri=1, ... Wed=6
  local.setDate(local.getDate() - back);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
const write = (rel, data) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return null; } };

async function flyers() {
  const debut = weekKey(), file = `data/flyers/${debut}.json`;
  const old = read(file);
  if (old && !force && JSON.parse(old).raw.length >= 80) { console.log(`${file} already done`); return; }
  const raw = await Flipp.collect(POSTAL, debut, { pause: 250, progress: (n, t) => { if (n % 20 === 0) console.log(`${n}/${t}`); } });
  console.log(`${raw.length} flyer items for the week of ${debut}`);
  if (raw.length < 20) { console.log("Too few items: the new flyers are probably not online yet."); process.exitCode = 0; return; }
  const fin = addDays(debut, 6);
  write(file, JSON.stringify({ debut, fin, made: new Date().toISOString(), postal: POSTAL, source: "Circulaires Flipp", raw }));
  const idx = JSON.parse(read("data/flyers/index.json") || "[]").filter((w) => w !== debut).concat(debut).sort().slice(-60);
  write("data/flyers/index.json", JSON.stringify(idx));
}

// ---------- past year: Noovo Moi weekly article "circulaires-epicerie-19-au-25-novembre-2026" ----------
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
function slugs(debut) {
  const a = new Date(debut + "T12:00:00Z"), b = new Date(a.getTime() + 6 * 864e5);
  const da = a.getUTCDate(), db = b.getUTCDate(), ma = MOIS[a.getUTCMonth()], mb = MOIS[b.getUTCMonth()], ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
  const d1 = da === 1 ? ["1er", "1"] : [String(da)], d2 = db === 1 ? ["1er", "1"] : [String(db)];
  const out = [];
  for (const x of d1) for (const y of d2) {
    if (ma === mb) out.push(`circulaires-epicerie-${x}-au-${y}-${mb}-${yb}`);
    else if (ya === yb) out.push(`circulaires-epicerie-${x}-${ma}-au-${y}-${mb}-${yb}`);
    else out.push(`circulaires-epicerie-${x}-${ma}-${ya}-au-${y}-${mb}-${yb}`, `circulaires-epicerie-${x}-${ma}-au-${y}-${mb}-${yb}`);
  }
  return out;
}
function textOf(html) {
  const art = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
  return art.replace(/<(script|style|noscript|svg|figure|aside|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h\d|li|div|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
async function noovo(n) {
  const now = weekKey(), done = JSON.parse(read("data/noovo/index.json") || "[]");
  for (let k = 1; k <= n; k++) {
    const debut = addDays(now, -7 * k);
    if (done.includes(debut)) continue;
    let ok = false;
    for (const s of slugs(debut)) {
      for (const host of ["https://www.noovomoi.ca", "https://noovomoi.ca"]) {
        const url = `${host}/cuisiner/trucs-inspirations/article/${s}/`;
        try {
          const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (PanierFute robot)" } });
          if (!r.ok) continue;
          const t = textOf(await r.text());
          if (t.length < 800 || !/\$/.test(t)) continue;
          write(`data/noovo/${debut}.txt`, `SOURCE: ${url}\nSEMAINE: ${debut} au ${addDays(debut, 6)}\n\n` + t.slice(0, 40000));
          done.push(debut); ok = true; console.log(`noovo ${debut} ok`);
          break;
        } catch (e) { /* try the next address */ }
      }
      if (ok) break;
      await new Promise((res) => setTimeout(res, 400));
    }
    if (!ok) console.log(`noovo ${debut}: not found`);
  }
  write("data/noovo/index.json", JSON.stringify([...new Set(done)].sort()));
}

await flyers();
if (backfill) await noovo(backfill);
