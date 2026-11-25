// Panier futé - weekly robot (runs on GitHub Actions, free).
// 1) Reads this week's flyers (Flipp) for every Quebec region in flipp.js and saves them in <out>/data/flyers/<region>/<thursday>.json
// 2) Reads the flyers of the stores people added by link (shared list) and saves their text in <out>/data/custom/<id>/<thursday>.txt
// 3) With --backfill N: saves the weekly Noovo Moi flyer article of the past N weeks in <out>/data/noovo/<thursday>.txt
// The files go to the "data" branch, rebuilt each week (only the last weeks are kept, so the repository stays small).
// No AI key needed here: the app turns these files into specials (and uses its own AI only without web search).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Flipp = require(path.join(ROOT, "flipp.js"));
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=").slice(1).join("=") : d; };
const OUT = path.resolve(arg("out", ROOT));
const backfill = Number(arg("backfill", 0));
const force = args.includes("--force");
const KEEP_WEEKS = 10;
const OWNER = process.env.GITHUB_REPOSITORY || "benbeann-art/panier-fute";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(new Date(s + "T12:00:00Z").getTime() + n * 864e5));
function weekKey(d = new Date()) { // Thursday of the flyer week (Thursday -> Wednesday), Montreal time
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const back = (local.getDay() + 3) % 7; // Thu=0, Fri=1, ... Wed=6
  local.setDate(local.getDate() - back);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
const write = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const read = (rel) => { try { return fs.readFileSync(path.join(OUT, rel), "utf8"); } catch { return null; } };
const prune = (dir, ext) => { // keep only the last weeks
  const idx = JSON.parse(read(`${dir}index.json`) || "[]").sort();
  const cut = addDays(weekKey(), -7 * KEEP_WEEKS);
  for (const w of idx.filter((w) => w < cut)) { try { fs.unlinkSync(path.join(OUT, `${dir}${w}${ext}`)); } catch {} }
  write(`${dir}index.json`, JSON.stringify(idx.filter((w) => w >= cut)));
};

// ---------- 1) Flipp flyers, every region ----------
async function flyers(reg) {
  const dir = `data/flyers/${reg.id}/`;
  const debut = weekKey(), file = `${dir}${debut}.json`;
  const old = read(file);
  if (old && !force && JSON.parse(old).raw.length >= 80) { console.log(`${reg.name}: already done`); return; }
  const raw = await Flipp.collect(reg.postal, debut, { pause: 150 });
  console.log(`${reg.name}: ${raw.length} flyer items for the week of ${debut}`);
  if (raw.length < 20) return;
  // snacks, coffee, drinks without a size in their name: the item's own page has it (compared per 100 g / per litre)
  try { await Flipp.addDetails(raw.filter((r) => String(r.ing).startsWith("k_")), { maxDetails: 200 }); } catch (e) {}
  write(file, JSON.stringify({ debut, fin: addDays(debut, 6), made: new Date().toISOString(), region: reg.name, raw }));
  const idx = JSON.parse(read(`${dir}index.json`) || "[]").filter((w) => w !== debut).concat(debut).sort();
  write(`${dir}index.json`, JSON.stringify(idx));
  prune(dir, ".json");
}

// ---------- 2) stores added by link (PDF or web page) ----------
let pdfParse = null;
try { pdfParse = require("pdf-parse/lib/pdf-parse.js"); } catch (e) { console.log("pdf-parse not installed: PDF text skipped"); }
const htmlText = (html) => html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|h\d|li|div|tr|td)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
async function textOfUrl(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (PanierFute robot)" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const type = r.headers.get("content-type") || "";
  if (/pdf/i.test(type) || /\.pdf(\?|$)/i.test(url)) {
    if (!pdfParse) return "";
    const buf = Buffer.from(await r.arrayBuffer());
    return (await pdfParse(buf)).text || "";
  }
  const html = await r.text();
  const pdfs = [...new Set((html.match(/(?:https?:)?\/\/[^"'\s>]+\.pdf(?:\?[^"'\s>]*)?/gi) || []).map((u) => (u.startsWith("//") ? "https:" + u : u).replace(/&amp;/g, "&")))].slice(0, 10);
  if (pdfs.length) { let t = ""; for (const u of pdfs) { try { t += "\n\n" + (await textOfUrl(u)); } catch (e) {} } if (t.trim().length > 300) return t; }
  return htmlText(html);
}
async function customStores() {
  let list = [];
  try {
    const user = OWNER.split("/")[0];
    const gists = await (await fetch(`https://api.github.com/users/${user}/gists?per_page=100`, { headers: { accept: "application/vnd.github+json" } })).json();
    const found = (gists || []).find((x) => x.files && x.files["panierfute-epiceries.json"]);
    if (!found) { console.log("no shared store list yet"); return; }
    const g = await (await fetch(`https://api.github.com/gists/${found.id}`, { headers: { accept: "application/vnd.github+json" } })).json();
    const f = Object.values(g.files || {})[0];
    list = JSON.parse((f && f.content) || "[]");
  } catch (e) { console.log("no shared store list"); return; }
  const debut = weekKey();
  for (const st of list.filter((x) => x && x.id && /^https?:\/\//.test(x.url || "")).slice(0, 60)) {
    const dir = `data/custom/${st.id.replace(/[^a-z0-9-]/gi, "")}/`;
    try {
      const t = (await textOfUrl(st.url)).slice(0, 60000);
      if (t.length < 300 || !/\d[,.]\d\d|\$/.test(t)) { console.log(`${st.name}: no readable text (the app will read it itself)`); continue; }
      write(`${dir}${debut}.txt`, `MAGASIN: ${st.name}\nSOURCE: ${st.url}\nSEMAINE: ${debut}\n\n${t}`);
      const idx = JSON.parse(read(`${dir}index.json`) || "[]").filter((w) => w !== debut).concat(debut).sort();
      write(`${dir}index.json`, JSON.stringify(idx));
      prune(dir, ".txt");
      console.log(`${st.name}: ${t.length} characters`);
    } catch (e) { console.log(`${st.name}: ${e.message}`); }
  }
}

// ---------- 3) past year: Noovo Moi weekly article ----------
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
async function noovo(n) {
  const now = weekKey(), done = JSON.parse(read("data/noovo/index.json") || "[]");
  for (let k = 1; k <= n; k++) {
    const debut = addDays(now, -7 * k);
    if (done.includes(debut)) continue;
    let ok = false;
    for (const s of slugs(debut)) {
      for (const host of ["https://www.noovomoi.ca", "https://noovomoi.ca"]) {
        try {
          const url = `${host}/cuisiner/trucs-inspirations/article/${s}/`;
          const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (PanierFute robot)" } });
          if (!r.ok) continue;
          const html = await r.text(), t = htmlText((html.match(/<article[\s\S]*?<\/article>/i) || [html])[0]);
          if (t.length < 800 || !/\$/.test(t)) continue;
          write(`data/noovo/${debut}.txt`, `SOURCE: ${url}\nSEMAINE: ${debut} au ${addDays(debut, 6)}\n\n` + t.slice(0, 40000));
          done.push(debut); ok = true; console.log(`noovo ${debut} ok`);
          break;
        } catch (e) { /* next address */ }
      }
      if (ok) break;
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  write("data/noovo/index.json", JSON.stringify([...new Set(done)].sort()));
}

const only = arg("regions", "");
for (const reg of Flipp.REGIONS.filter((r) => !only || only.split(",").includes(r.id))) { try { await flyers(reg); } catch (e) { console.log(`${reg.name}: ${e.message}`); } }
await customStores();
if (backfill) await noovo(backfill);
write("data/regions.json", JSON.stringify({ made: new Date().toISOString(), week: weekKey(), owner: OWNER, regions: Flipp.REGIONS.map((r) => r.id) }));
