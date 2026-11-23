// Panier futé - prices of 2026 for the price history. No AI, nothing invented: a price is kept only when the number,
// its unit and the store are written right next to the product.
// A) Noovo Moi weekly flyer articles (2026 only): finds the missing weeks, then reads lines like
//    "5,44$/lb chez Maxi; 5,75$/lb chez Adonis" under the product name.
// B) Maxi and Provigo websites: today's price of every app ingredient (regular price, and the sale price when on special).
// Output, in <out> (the "data" branch):
//   data/noovo/<thursday>.txt            article text (kept, with its address)
//   data/hist/<thursday>.json            {debut, items:[{ing, mag, prix, qte, unite, txt, src}]}  (2026 weeks only)
//   data/hist/index.json                 weeks available
//   data/reg/latest.json                 {date, stores:{Maxi:{ing:{pu, n, txt}}, Provigo:{...}}}  everyday prices per gram / ml / unit
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Flipp = require(path.join(ROOT, "flipp.js"));
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=").slice(1).join("=") : d; };
const OUT = path.resolve(arg("out", ROOT));
const PARTS = arg("parts", "noovo,sites").split(",");
const YEAR_START = "2026-01-01", YEAR_END = "2026-12-31";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(new Date(s + "T12:00:00Z").getTime() + n * 864e5));
function weekKey(d = new Date()) { // Thursday of the flyer week, Montreal time
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  local.setDate(local.getDate() - ((local.getDay() + 3) % 7));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
const write = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const read = (rel) => { try { return fs.readFileSync(path.join(OUT, rel), "utf8"); } catch { return null; } };
const NUM = (s) => Number(String(s).replace(",", "."));

// the app's ingredients (units and names) come from index.html
function loadIng() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const a = html.indexOf("<script>window.DATA_RECETTES="), b = html.indexOf("</script>", a);
  const w = {}; vm.runInNewContext(html.slice(a + 8, b), { window: w });
  return w.DATA_RECETTES.ing;
}
const ING = loadIng();
const IDS = Object.keys(Flipp.TERMS).filter((id) => ING[id]);

// price per gram / ml / unit of a special, like the app's unitPrice
function unitPrice(sp, ing) {
  const q = sp.qte > 0 ? sp.qte : 1;
  if (ing.u === "g") return sp.unite === "lb" ? sp.prix / (Flipp.LB * q) : sp.unite === "kg" ? sp.prix / (1000 * q) : sp.unite === "g" ? sp.prix / q : null;
  if (ing.u === "ml") return sp.unite === "L" ? sp.prix / (1000 * q) : sp.unite === "ml" ? sp.prix / q : null;
  if (ing.u === "u") return sp.unite === "u" ? sp.prix / q : null;
  return null;
}
// a price far from the usual one is almost surely a reading mistake: not kept
const believable = (sp) => { const ing = ING[sp.ing], pu = unitPrice(sp, ing); return pu > 0 && ing.p > 0 && pu >= ing.p * 0.2 && pu <= ing.p * 4; };

// ---------- A) Noovo Moi ----------
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
function slugs(debut) {
  const out = [];
  for (const shift of [0, -1, 1]) { // some articles are dated from Wednesday or Friday
    const a = new Date(addDays(debut, shift) + "T12:00:00Z"), b = new Date(a.getTime() + 6 * 864e5);
    const da = a.getUTCDate(), db = b.getUTCDate(), ma = MOIS[a.getUTCMonth()], mb = MOIS[b.getUTCMonth()], ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
    const d1 = da === 1 ? ["1er", "1"] : [String(da)], d2 = db === 1 ? ["1er", "1"] : [String(db)];
    for (const x of d1) for (const y of d2) for (const p of ["circulaires-epicerie", "circulaires-epiceries", "circulaire-epicerie"]) {
      if (ma === mb) out.push(`${p}-${x}-au-${y}-${mb}-${yb}`, `${p}-du-${x}-au-${y}-${mb}-${yb}`);
      else { out.push(`${p}-${x}-${ma}-au-${y}-${mb}-${yb}`, `${p}-du-${x}-${ma}-au-${y}-${mb}-${yb}`); if (ya !== yb) out.push(`${p}-${x}-${ma}-${ya}-au-${y}-${mb}-${yb}`); }
    }
  }
  return [...new Set(out)];
}
const htmlText = (html) => html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|h\d|li|div|tr|td)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

async function noovoFetchMissing() {
  const done = new Set(JSON.parse(read("data/noovo/index.json") || "[]"));
  const weeks = [];
  for (let w = weekKey(); w >= YEAR_START; w = addDays(w, -7)) if (w <= YEAR_END && !done.has(w)) weeks.push(w);
  for (const debut of weeks) {
    let ok = false;
    for (const s of slugs(debut)) {
      for (const host of ["https://www.noovomoi.ca", "https://noovomoi.ca"]) {
        try {
          const url = `${host}/cuisiner/trucs-inspirations/article/${s}/`;
          const r = await fetch(url, { headers: { "user-agent": UA } });
          if (!r.ok) continue;
          const t = htmlText(((await r.text()).match(/<article[\s\S]*?<\/article>/i) || [""])[0]);
          if (t.length < 800 || !/\$/.test(t)) continue;
          write(`data/noovo/${debut}.txt`, `SOURCE: ${url}\nSEMAINE: ${debut} au ${addDays(debut, 6)}\n\n` + t.slice(0, 40000));
          done.add(debut); ok = true; console.log(`noovo ${debut} found`);
          break;
        } catch (e) { /* next address */ }
      }
      if (ok) break;
      await sleep(250);
    }
    if (!ok) console.log(`noovo ${debut}: no article`);
  }
  write("data/noovo/index.json", JSON.stringify([...done].sort()));
  return [...done].sort();
}

const STORE_RE = /chez\s+(?:les\s+)?(Maxi|Super\s*C|IGA|Metro|Provigo|Walmart|Adonis|March[ée]s?\s+Tradition|Tigre\s+G[ée]ant)\b/gi;
const storeName = (s) => { const n = Flipp.norm(s); return n.startsWith("super") ? "Super C" : n.startsWith("tigre") ? "Tigre Géant" : /tradition/.test(n) ? "Marché Tradition" : Flipp.STORES.find((x) => Flipp.norm(x) === n) || null; };

// One article -> specials. A line with prices and "chez <store>" belongs to the product named on the line above it.
function parseNoovo(text, debut) {
  const src = (text.match(/^SOURCE: (.*)$/m) || [])[1] || "";
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 320 || !/\d\s*\$/.test(line) || !/chez\s/i.test(line)) continue;
    let prod = "";
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) if (!/\$/.test(lines[j]) && lines[j].length < 90) { prod = lines[j]; break; }
    let last = null;
    for (const seg of line.split(";")) {
      const stores = [...seg.matchAll(STORE_RE)].map((m) => storeName(m[1])).filter(Boolean);
      if (!stores.length) continue;
      const pour = seg.match(/(\d+)\s*pour\s*(\d+(?:[,.]\d{1,2})?)\s*\$/i);
      const pm = seg.match(/(?<![\d,.])(\d+(?:[,.]\d{2})?)\s*\$\s*(?:\/\s*(lb|kg|100\s*g)\b|(?:le|la)\s+(lb|kg)\b)?/i);
      // no price of its own: the price before only when this part names nothing but stores ("; chez Metro et chez Provigo")
      const onlyStores = !seg.replace(STORE_RE, " ").replace(/\b(et|ou|aussi|seulement|chez)\b/gi, " ").replace(/[\s,.]/g, "");
      let p = pour ? { prix: NUM(pour[2]), unit: "", mult: Number(pour[1]) } : pm ? { prix: NUM(pm[1]), unit: String(pm[2] || pm[3] || "").toLowerCase().replace(/\s/g, "") } : onlyStores ? last : null;
      if (!p) { last = null; continue; }
      last = p;
      const before = seg.split(/(?<![\d,.])\d+(?:[,.]\d{2})?\s*\$|\d+\s*pour/i)[0].replace(/[,:]\s*$/, "").trim();
      const name = before.length > 3 && !/^(chez|prix|seulement)\b/i.test(before) ? before : prod;
      const ids = IDS.filter((id) => Flipp.matches(id, name));
      if (ids.length !== 1) continue; // unknown or ambiguous product: skipped rather than guessed
      const id = ids[0], ing = ING[id];
      let size = null;
      if (p.unit === "lb" || p.unit === "kg") size = ing.u === "g" ? { qte: 1, unite: p.unit } : null;
      else if (p.unit === "100g") size = ing.u === "g" ? { qte: 100, unite: "g" } : null;
      else size = Flipp.sizeOf({ ing: id, name: `${name} ${prod}`, post: "", pre: p.mult ? `${p.mult} pour` : "", prix: p.prix }, ing.u);
      if (!size) continue; // no size written: no price per unit, skipped
      for (const mag of stores) {
        const sp = { ing: id, mag, prix: p.prix, qte: size.qte, unite: size.unite, txt: (name === prod ? prod : `${prod} : ${name}`).slice(0, 90), src };
        if (believable(sp)) items.push(sp);
      }
    }
  }
  return items;
}

// ---------- B) Maxi and Provigo websites ----------
const SUBST = /\b(alternative|substitut|a base de plantes|vegetal|vegetalien|vegane?|vegan|sans viande|imitation)\b/;
const SITES = { Maxi: "https://www.maxi.ca/fr/search?search-bar=", Provigo: "https://www.provigo.ca/fr/search?search-bar=" };
function tilesOf(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const out = [], seen = new Set();
  (function walk(o) {
    if (Array.isArray(o)) { for (const v of o) walk(v); return; }
    if (!o || typeof o !== "object") return;
    if (o.title && o.pricing && typeof o.pricing === "object" && !seen.has(o.articleNumber)) { seen.add(o.articleNumber); out.push(o); }
    for (const v of Object.values(o)) walk(v);
  })(JSON.parse(m[1]));
  return out;
}
// "550 g, 2,73 $/100g" or "8,58 $/1kg 3,89 $/1lb" or "2 l, 0,31 $/100ml" or "1 ea, 14,00 $/1ch" -> price per g / ml / unit
function perUnit(sizing, u, price) {
  const s = String(sizing || "").replace(/ /g, " ");
  let m;
  if (u === "g") {
    if ((m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*100\s*g/i))) return NUM(m[1]) / 100;
    if ((m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*1\s*kg/i))) return NUM(m[1]) / 1000;
    if ((m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*1\s*lb/i))) return NUM(m[1]) / Flipp.LB;
  }
  if (u === "ml") {
    if ((m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*100\s*ml/i))) return NUM(m[1]) / 100;
    if ((m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*1\s*l\b/i))) return NUM(m[1]) / 1000;
  }
  if (u === "u" && (m = s.match(/(\d+[,.]\d+)\s*\$\s*\/\s*1\s*ch/i))) return NUM(m[1]);
  // sold by the piece ("1 ea", "6 un") with the price of the package
  if (u === "u" && price > 0 && (m = s.match(/^\s*(\d+)\s*(ea|un|unit[ée]s?)\b/i))) return price / Number(m[1]);
  return null;
}
// the size of the package ("550 g", "1.575 kg", "2 l") for the sale price
function packOf(sizing) {
  const m = String(sizing || "").match(/^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!m) return null;
  const u = m[2].toLowerCase();
  return { qte: NUM(m[1]), unite: u === "l" ? "L" : u };
}
async function sites(debut) {
  const reg = { date: iso(new Date()), stores: {} }, specials = [];
  for (const [store, base] of Object.entries(SITES)) {
    reg.stores[store] = {};
    let fails = 0;
    for (const id of IDS) {
      const ing = ING[id];
      if (!["g", "ml", "u"].includes(ing.u)) continue;
      try {
        const r = await fetch(base + encodeURIComponent(Flipp.TERMS[id][0]), { headers: { "user-agent": UA, "accept-language": "fr-CA,fr;q=0.9" } });
        if (!r.ok) { if (++fails >= 8) { console.log(`${store}: stopped (HTTP ${r.status})`); break; } continue; }
        // the product must be this ingredient and only this one (no "bœuf et porc hachés" for ground beef), and no plant-based substitute
        const tiles = tilesOf(await r.text()).filter((t) => !t.isSponsored && Flipp.matches(id, t.title) && !IDS.some((o) => o !== id && Flipp.matches(o, t.title))
          && (!SUBST.test(Flipp.norm(t.title)) || SUBST.test(Flipp.norm(Flipp.TERMS[id][0]))));
        const regs = [];
        // club / bulk packs only when nothing else is sold
        const normal = tiles.filter((t) => !/\bclub\b|\bvrac\b|\bcaisse\b/.test(Flipp.norm(t.title)));
        for (const t of normal.length ? normal : tiles) {
          const pu = perUnit(t.packageSizing, ing.u, NUM(t.pricing.price)); if (!(pu > 0)) continue;
          const price = NUM(t.pricing.price), was = t.pricing.wasPrice ? NUM(String(t.pricing.wasPrice).replace(/[^\d,.]/g, "")) : 0;
          const regPu = was > price ? (pu * was) / price : pu;
          if (regPu >= ing.p * 0.2 && regPu <= ing.p * 4) regs.push({ pu: regPu, n: t.title });
          if (was > price && t.deal) { // on special this week, at this store's own website
            const weighted = /PRICED_BY_WEIGHT/.test((t.pricingUnits || {}).type || "");
            let sp = null;
            if (weighted && ing.u === "g") { const lb = String(t.packageSizing).match(/(\d+[,.]\d+)\s*\$\s*\/\s*1\s*lb/i); if (lb) sp = { prix: NUM(lb[1]), qte: 1, unite: "lb" }; }
            else { const pk = packOf(t.packageSizing); if (pk) sp = { prix: price, ...pk }; }
            if (sp) { const x = { ing: id, mag: store, ...sp, txt: `${t.brand ? t.brand + " " : ""}${t.title}`.slice(0, 90), src: base.split("/fr/")[0] + (t.link || "") }; if (believable(x)) specials.push(x); }
          }
        }
        // everyday price = the product at the first quarter of the prices (not the odd cheapest one, not the fancy ones)
        regs.sort((a, b) => a.pu - b.pu);
        if (regs.length) { const k = regs[Math.floor((regs.length - 1) / 4)]; reg.stores[store][id] = { pu: Math.round(k.pu * 1e6) / 1e6, n: regs.length, txt: k.n.slice(0, 80) }; }
        fails = 0;
      } catch (e) { if (++fails >= 8) { console.log(`${store}: stopped (${e.message})`); break; } }
      await sleep(1200);
    }
    console.log(`${store}: ${Object.keys(reg.stores[store]).length} everyday prices`);
  }
  if (Object.values(reg.stores).some((s) => Object.keys(s).length > 20)) write("data/reg/latest.json", JSON.stringify(reg));
  return specials;
}

// ---------- write the history weeks (2026 only) ----------
const weeks = {};
if (PARTS.includes("noovo")) {
  const list = args.includes("--offline") ? JSON.parse(read("data/noovo/index.json") || "[]") : await noovoFetchMissing();
  for (const w of list) {
    if (w < YEAR_START || w > YEAR_END) continue;
    const t = read(`data/noovo/${w}.txt`); if (!t) continue;
    const items = parseNoovo(t, w);
    (weeks[w] = weeks[w] || []).push(...items);
    console.log(`noovo ${w}: ${items.length} prices`);
  }
}
if (PARTS.includes("sites")) {
  const w = weekKey();
  const sp = await sites(w);
  if (w >= YEAR_START && w <= YEAR_END) (weeks[w] = weeks[w] || []).push(...sp);
  console.log(`sites: ${sp.length} specials this week`);
}
const idx = new Set(JSON.parse(read("data/hist/index.json") || "[]"));
for (const [w, items] of Object.entries(weeks)) {
  const old = JSON.parse(read(`data/hist/${w}.json`) || "null");
  const keep = (old && old.items || []).filter((x) => !items.some((y) => y.src === x.src)); // the same source read again replaces itself
  const all = keep.concat(items);
  if (!all.length) continue;
  write(`data/hist/${w}.json`, JSON.stringify({ debut: w, fin: addDays(w, 6), made: new Date().toISOString(), items: all }));
  idx.add(w);
}
write("data/hist/index.json", JSON.stringify([...idx].filter((w) => w >= YEAR_START && w <= YEAR_END).sort()));
console.log(`history weeks: ${idx.size}`);
