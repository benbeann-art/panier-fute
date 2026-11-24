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
    const rabais = amt("ÉCONOMISEZ"), prix = amt("OFFRE CHOC");
    if (!rabais && !prix) continue;
    const ou = t.includes("En entrepôt seulement") ? "entrepôt" : "entrepôt et en ligne";
    const food = !!size && /\d\s*(g|kg|ml|l)\b/i.test(size) && !NOT_FOOD.test(n + " " + size);
    if (!food) continue;
    // the ingredient must be what the product is ("Fromage à la crème Philadelphia"), not a part of it ("Cannelloni aux épinards")
    const nn = Flipp.norm(n);
    const ings = IDS.filter((id) => Flipp.matches(id, n) && (Flipp.TERMS[id] || []).some((w) => nn.startsWith(Flipp.norm(String(w)))));
    out.push({ n, size, no, du, au, rabais, prix, ou, ing: ings.length === 1 ? ings[0] : null });
  }
  return out;
}

async function main() {
  let html;
  if (arg("file")) html = fs.readFileSync(arg("file"), "utf8");
  else {
    const r = await fetch(URL_FR, { headers: { "User-Agent": UA, "Accept-Language": "fr-CA,fr;q=0.9", Accept: "text/html" } });
    if (!r.ok) { console.log(`Costco: HTTP ${r.status}, nothing changed`); return; }
    html = await r.text();
  }
  const items = parse(html);
  console.log(`Costco: ${items.length} food items in the circulaire (${items.filter((x) => x.ing).length} matched to an ingredient)`);
  if (items.length < 5) { console.log("Costco: too few items, the page may have changed - nothing written"); return; }
  const dir = path.join(OUT, "data", "costco");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify({ made: new Date().toISOString(), url: URL_FR, items }));
}

if (process.argv[1] && process.argv[1].endsWith("costco.mjs")) main().catch((e) => { console.log("Costco: " + e.message); });
