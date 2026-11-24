// Costco circulaire (warehouse savings / coupon book) from costco.ca/coupons.html
// The page gives the product, its size, the dates and the amount saved ("ÉCONOMISEZ 3 $"),
// or the final price for an "OFFRE CHOC". It never gives the regular warehouse price.
// Output: data/costco/latest.json  { made, url, items: [{ n, size, no, du, au, rabais, prix, ou, ing }] }
// Usage: node robot/costco.mjs --out=../d   (or --file=page.html to parse a saved page)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Flipp = require(path.join(ROOT, "flipp.js"));
const args = process.argv.slice(2);
const arg = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const OUT = path.resolve(arg("out") || path.join(ROOT, "..", "d"));
const URL_FR = "https://www.costco.ca/coupons.html?langId=-25";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const IDS = Object.keys(Flipp.TERMS);
const MONTHS = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 };
// not food even with a size in g / ml
const NOT_FOOD = /(hydrat|capsules? (pour|de s|de c)|shampo|revitalis|savon|détergent|lessive|vitamine|gélule|nettoyant|papier|mouchoir|couches|lingettes|pneu|nourriture pour|litière|désodoris|rinçage|machine|téléviseur|réfrigérateur|jeté|sérum|crème pour|lotion|dentifrice)/i;

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const textOf = (h) => decode(h.replace(/<[^>]+>/g, "|")).replace(/\s*\|[\s|]*/g, "|");

function isoDate(day, month, year) {
  const m = MONTHS[month.toLowerCase()];
  return m ? `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function parse(html) {
  const out = [];
  const parts = html.split(/(?=<div class="MuiGrid-root MuiGrid-direction-xs-row MuiGrid-grid-sm-6)/).slice(1);
  for (const p of parts) {
    const t = textOf(p).split("|").map((x) => x.trim()).filter(Boolean);
    const no = (t.find((x) => /^N\S{0,2}\s*d.article/i.test(x)) || "").replace(/\D+/g, "") || null;
    const v = t.join(" ").match(/Valide du (\d{1,2})(?: ([a-zéû]+))? au (\d{1,2}) ([a-zéû]+) (\d{4})/i);
    if (!v || !no) continue;
    const au = isoDate(v[3], v[4], v[5]);
    const du = isoDate(v[1], v[2] || v[4], Number(v[5]) - (v[2] && MONTHS[v[2].toLowerCase()] > MONTHS[v[4].toLowerCase()] ? 1 : 0));
    const n = t[0].replace(/\s+/g, " ").replace(/\*$/, "");
    const iNo = t.findIndex((x) => /^N\S{0,2}\s*d.article/i.test(x));
    const size = iNo > 1 && /\d/.test(t[iNo - 1]) && t[iNo - 1] !== n ? t[iNo - 1] : null;
    // the amount: "ÉCONOMISEZ|3|,|50|$" or "OFFRE CHOC|24|,|99|$"
    const amt = (label) => { const i = t.indexOf(label); if (i < 0) return null; let s = ""; for (let k = i + 1; k < t.length && t[k] !== "$"; k++) s += t[k]; const x = Number(s.replace(",", ".")); return x > 0 ? x : null; };
    const rabais = amt("ÉCONOMISEZ");
    // filled in by the page's script: "En entrepôt 5,99 $ · Économie -1,50 $ · Prix 4,49 $"
    const j = t.join(" ").replace(/\u00a0/g, " ");
    const wp = j.match(/En entrep[ôo]t\s+(\d+(?:\s\d{3})*,\d{2})\s*\$/i), fp = j.match(/\bPrix\s+(\d+(?:\s\d{3})*,\d{2})\s*\$/);
    const reg = wp ? Number(wp[1].replace(/\s/g, "").replace(",", ".")) : null;
    const prix = amt("OFFRE CHOC") || (fp ? Number(fp[1].replace(/\s/g, "").replace(",", ".")) : null);
    if (!rabais && !prix) continue;
    const ou = t.includes("En entrepôt seulement") ? "entrepôt" : "entrepôt et en ligne";
    const food = !!size && /\d\s*(g|kg|ml|l)\b/i.test(size) && !NOT_FOOD.test(n + " " + size);
    if (!food) continue;
    // the ingredient must be what the product is ("Fromage à la crème Philadelphia"), not a part of it ("Cannelloni aux épinards")
    const nn = Flipp.norm(n);
    const ings = IDS.filter((id) => Flipp.matches(id, n) && (id.startsWith("k_") || (Flipp.TERMS[id] || []).some((w) => { const a = nn.split(/\s+/)[0], b = Flipp.norm(String(w)).split(/\s+/)[0]; return a.startsWith(b) || b.startsWith(a); })));
    // the product photo (Costco's image server; a smaller size is enough for the phone)
    const im = p.match(/<img[^>]+src="(https:\/\/[^"]*costco[^"]*)"/i);
    const img = im ? decode(im[1]).replace(/width=\d+/, "width=320").replace(/height=\d+/, "height=320") : null;
    out.push({ n, size, no, du, au, rabais, prix, reg, ou, img, ing: ings.length === 1 ? ings[0] : null });
  }
  return out;
}

// ---------- Narcity: the monthly "Costco circulaire" articles give the real warehouse price ----------
// JSON-LD ItemList: name + "Prix : 13,99 $ plutôt que 18,99 $, soit 5 $ de rabais (valide jusqu'au 22 novembre 2026)
// Prix par 100 g : Environ 0,98 $ Cette boîte de 1,43 kg ..."
const NARCITY_SEEDS = ["https://www.narcity.com/fr/costco-rabais-circulaire-novembre-decembre-2026", "https://www.narcity.com/fr/costco-rabais-circulaire-novembre-2026"];
const num = (x) => Number(String(x).replace(/\s/g, "").replace(",", "."));
export function parseNarcity(html, url) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch (e) { continue; }
    if (!d || d["@type"] !== "ItemList") continue;
    for (const it of d.itemListElement || []) {
      const t = it.item || {}, n = decode(String(t.name || "")).trim(), desc = decode(String(t.description || ""));
      const p = desc.match(/Prix\s*:\s*([\d\s]+(?:,\d{2})?)\s*\$\s*plutôt que\s*([\d\s]+(?:,\d{2})?)\s*\$/i);
      if (!n || !p) continue;
      const v = desc.match(/valide (?:du (\d{1,2})(?: ([a-zéû]+))? )?(?:au|jusqu.au) (\d{1,2}) ([a-zéû]+) (\d{4})/i);
      const au = v ? isoDate(v[3], v[4], v[5]) : null, du = v && v[1] ? isoDate(v[1], v[2] || v[4], v[5]) : null;
      // the size written in the text ("boîte de 1,43 kg", "deux pots de 565 g"), else the rounded price per 100 g
      const sz = desc.match(/(?:de|d’|d')\s*(\d+(?:,\d+)?)\s*(kg|g|ml|l)\b/i);
      const per = desc.match(/Prix par 100 (g|ml)\s*:\s*Environ\s*([\d,]+)\s*\$/i);
      let qte = null, unite = null;
      if (sz) { qte = num(sz[1]); unite = sz[2].toLowerCase(); if (unite === "kg") { qte *= 1000; unite = "g"; } if (unite === "l") { qte *= 1000; unite = "ml"; } }
      // "deux pots de 565 g", "32 fromages de 20 g": the whole pack
      const WORDS = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, huit: 8, dix: 10, douze: 12 };
      const mult = desc.match(/\b(\d+|deux|trois|quatre|cinq|six|huit|dix|douze)\s+[a-zàâçéèêëîïôûù’'-]+\s+(?:[a-zàâçéèêëîïôûù’'-]+\s+)?(?:de|d’|d')\s*\d+(?:,\d+)?\s*(?:kg|g|ml|l)\b/i);
      if (qte && mult) qte *= WORDS[mult[1].toLowerCase()] || Number(mult[1]) || 1;
      // "Prix par fromage : Environ 7 $" for 13,99 $ = 2 cheeses
      const each = desc.match(/Prix par (?!100 )[a-zàâçéèêëîïôûù’' -]+\s*:\s*Environ\s*([\d,]+)\s*\$/i);
      if (qte && !mult && each) { const c = Math.round(num(p[1]) / num(each[1])); if (c > 1 && c <= 12) qte *= c; }
      // check with the price per 100 g when given (it is rounded: 15 % is fine)
      if (per && unite === per[1].toLowerCase()) { const est = num(p[1]) / num(per[2]) * 100; if (!qte || Math.abs(qte / est - 1) > 0.15) { qte = Math.round(est); } }
      const nn = Flipp.norm(n);
      const ings = IDS.filter((id) => Flipp.matches(id, n) && (id.startsWith("k_") || (Flipp.TERMS[id] || []).some((w) => { const a = nn.split(/\s+/)[0], b = Flipp.norm(String(w)).split(/\s+/)[0]; return a.startsWith(b) || b.startsWith(a); })));
      out.push({ n, prix: num(p[1]), reg: num(p[2]), du, au, qte, unite, per100: per ? { u: per[1].toLowerCase(), p: num(per[2]) } : null, ing: ings.length === 1 ? ings[0] : null, src: url });
    }
  }
  return out;
}
async function narcity() {
  const seen = new Set(), todo = NARCITY_SEEDS.slice(), items = [], today = new Date().toISOString().slice(0, 10);
  while (todo.length && seen.size < 6) {
    const u = todo.shift(); if (seen.has(u)) continue; seen.add(u);
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "fr-CA,fr;q=0.9" } });
      if (!r.ok) { console.log(`Narcity: HTTP ${r.status} ${u}`); continue; }
      const h = await r.text();
      const got = parseNarcity(h, u).filter((x) => x.au && x.au >= today); // no end date read = not sure it is current: skipped
      console.log(`Narcity: ${got.length} current deals in ${u}`);
      items.push(...got);
      // newer "costco-rabais-circulaire-..." articles are linked from the older ones
      for (const l of new Set(h.match(/https:\/\/www\.narcity\.com\/fr\/costco-rabais-circulaire-[a-z0-9-]+/g) || [])) if (!seen.has(l) && /-20(2[6-9]|3\d)$/.test(l)) todo.push(l);
    } catch (e) { console.log("Narcity: " + e.message); }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return items;
}

// The warehouse prices ("En entrepôt", "Prix") are written by the page's own script after it loads:
// open it like a visitor in headless Chrome, scroll to the bottom so every card loads, and take the result.
async function rendered() {
  let pw; try { pw = await import("playwright"); } catch (e) { console.log("Costco: no headless browser, prices not read"); return null; }
  const b = await pw.chromium.launch();
  try {
    const pg = await b.newPage({ userAgent: UA, locale: "fr-CA" });
    await pg.goto(URL_FR, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let k = 0; k < 40; k++) { await pg.mouse.wheel(0, 1500); await pg.waitForTimeout(400); }
    await pg.waitForTimeout(4000);
    const h = await pg.content();
    if (arg("dump")) fs.writeFileSync(arg("dump"), h);
    console.log(`Costco: page opened in headless Chrome, ${h.length} characters`);
    return h;
  } catch (e) { console.log("Costco browser: " + e.message); return null; } finally { await b.close(); }
}

async function main() {
  let html;
  if (arg("file")) html = fs.readFileSync(arg("file"), "utf8");
  else {
    html = await rendered();
    // Costco sometimes answers with a short page (no products): try again a few times
    for (let k = 0; k < 4 && !(html && parse(html).length >= 5); k++) {
      if (k) await new Promise((ok) => setTimeout(ok, 20000));
      try {
        const r = await fetch(URL_FR, { headers: { "User-Agent": UA, "Accept-Language": "fr-CA,fr;q=0.9", Accept: "text/html,application/xhtml+xml" } });
        html = await r.text();
        console.log(`Costco: try ${k + 1}, HTTP ${r.status}, ${html.length} characters`);
        if (r.ok && parse(html).length >= 5) break;
      } catch (e) { console.log("Costco: " + e.message); }
    }
  }
  let items = parse(html || "");
  console.log(`Costco: ${items.length} food items in the circulaire (${items.filter((x) => x.ing).length} matched to an ingredient, ${items.filter((x) => x.prix).length} with the warehouse price)`);
  const dir = path.join(OUT, "data", "costco"), file = path.join(dir, "latest.json");
  let old = null; try { old = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  if (items.length < 5) { console.log("Costco: too few items, keeping the last circulaire"); items = old ? old.items : []; }
  const nar = arg("file") ? [] : await narcity();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ made: new Date().toISOString(), url: URL_FR, items, narcity: nar.length ? nar : (old && old.narcity) || [] }));
}

if (process.argv[1] && process.argv[1].endsWith("costco.mjs")) main().catch((e) => { console.log("Costco: " + e.message); });
