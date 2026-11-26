import { summary, okSym, nseGet, UA } from "./_y.js";
const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };
const r = (o) => (o && typeof o.raw === "number" ? o.raw : null);
const ts = (s) => { const t = Date.parse(s); return isNaN(t) ? null : Math.floor(t / 1000); };

async function yahoo(s) {
  const R = await summary(s, "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,calendarEvents");
  const p = R.price || {}, sd = R.summaryDetail || {}, ks = R.defaultKeyStatistics || {}, fd = R.financialData || {}, ap = R.assetProfile || {}, ce = R.calendarEvents || {};
  return {
    name: p.longName || p.shortName || null, cur: p.currency || null, sector: ap.sector || null, industry: ap.industry || null,
    mcap: r(p.marketCap), pe: r(sd.trailingPE), fpe: r(sd.forwardPE), dy: r(sd.dividendYield), beta: r(sd.beta), avgVol: r(sd.averageVolume),
    eps: r(ks.trailingEps), pb: r(ks.priceToBook), roe: r(fd.returnOnEquity), margin: r(fd.profitMargins),
    earnings: ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate[0] ? r(ce.earnings.earningsDate[0]) : null,
    exDiv: r(ce.exDividendDate), divDate: r(ce.dividendDate),
  };
}
async function nasdaq(s) {
  const H = { ...UA, Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };
  const x = await fetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(s)}/summary?assetclass=stocks`, { headers: H, signal: AbortSignal.timeout(7000) });
  if (!x.ok) throw new Error("nasdaq " + x.status);
  const d = (await x.json()).data;
  const m = d && d.summaryData;
  if (!m) throw new Error("nasdaq empty");
  const v = (k) => (m[k] ? m[k].value : null);
  return {
    cur: "USD", sector: v("Sector"), industry: v("Industry"), mcap: num(v("MarketCap")), pe: num(v("PERatio")), fpe: num(v("ForwardPE1Yr")),
    eps: num(v("EarningsPerShare")), dy: num(v("Yield")) != null ? num(v("Yield")) / 100 : null, beta: num(v("Beta")),
    avgVol: num(v("AvgDailyVol")) || num(v("ShareVolume")), exDiv: ts(v("ExDividendDate")), divDate: ts(v("DividendPaymentDate")),
  };
}
async function screener(base) {
  let h = null;
  for (const path of ["consolidated/", ""]) {
    const x = await fetch(`https://www.screener.in/company/${encodeURIComponent(base)}/${path}`, { headers: { "User-Agent": UA["User-Agent"], Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (x.ok) { h = await x.text(); if (/Market Cap/.test(h)) break; }
  }
  if (!h) throw new Error("screener no page");
  const f = {};
  for (const m of h.matchAll(/<li[^>]*>\s*<span class="name">\s*([^<]+?)\s*<\/span>\s*<span class="nowrap value">([\s\S]*?)<\/li>/g)) f[m[1].trim()] = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const price = num(f["Current Price"]), pe = num(f["Stock P/E"]), bv = num(f["Book Value"]);
  if (!f["Market Cap"]) throw new Error("screener parse");
  const nm = h.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
  return {
    name: nm ? nm[1] : null, cur: "INR", mcap: num(f["Market Cap"]) != null ? num(f["Market Cap"]) * 1e7 : null, pe,
    dy: num(f["Dividend Yield"]) != null ? num(f["Dividend Yield"]) / 100 : null, roe: num(f["ROE"]) != null ? num(f["ROE"]) / 100 : null,
    pb: price && bv ? price / bv : null, eps: price && pe ? price / pe : null,
  };
}
async function nseInfo(base) {
  const [q, a] = await nseGet([`/api/quote-equity?symbol=${encodeURIComponent(base)}`, `/api/corporates-corporateActions?index=equities&symbol=${encodeURIComponent(base)}`]);
  if (!q && !a) throw new Error("nse blocked");
  const ii = (q && q.industryInfo) || {}, md = (q && q.metadata) || {}, now = Date.now() / 1000 - 864e2, actions = [];
  for (const x of Array.isArray(a) ? a : []) {
    const s = String(x.subject || ""), d = ts(x.exDate);
    const t = /bonus/i.test(s) ? "Bonus" : /split|sub-?division/i.test(s) ? "Split" : /rights/i.test(s) ? "Rights" : /dividend/i.test(s) ? "Dividend" : null;
    if (t && d && d >= now) actions.push({ t, h: s.slice(0, 70), date: d });
  }
  actions.sort((x, y) => x.date - y.date);
  return { sector: ii.sector || ii.macro || null, industry: ii.industry || ii.basicIndustry || null, pe: typeof md.pdSymbolPe === "number" ? md.pdSymbolPe : num(md.pdSymbolPe), actions: actions.slice(0, 6) };
}
export default async function handler(req, res) {
  const s = String(req.query.s || "").trim();
  if (!okSym(s)) return res.status(400).json({ error: "bad symbol" });
  const out = { name: null, cur: null, sector: null, industry: null, mcap: null, pe: null, fpe: null, dy: null, beta: null, avgVol: null, eps: null, pb: null, roe: null, margin: null, earnings: null, exDiv: null, divDate: null, actions: [] };
  const log = [];
  const fill = (p) => { for (const k in p) { if (k === "actions") { if (p.actions && p.actions.length) out.actions = p.actions; } else if (out[k] == null && p[k] != null) out[k] = p[k]; } };
  const run = async (n, fn) => { try { fill(await fn()); log.push({ src: n, ok: true }); } catch (e) { log.push({ src: n, ok: false, err: String((e && e.message) || e).slice(0, 80) }); } };
  const ind = /\.(NS|BO)$/.test(s), base = s.replace(/\.(NS|BO)$/, "");
  await run("yahoo", () => yahoo(s));
  if (ind) {
    const jobs = [];
    if (/\.NS$/.test(s)) jobs.push(run("nse", () => nseInfo(base)));
    if (out.mcap == null || out.pe == null) jobs.push(run("screener", () => screener(base)));
    await Promise.all(jobs);
  } else if (s[0] !== "^" && (out.mcap == null || out.exDiv == null)) await run("nasdaq", () => nasdaq(s));
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
  res.status(200).json({ ...out, sources: log });
}
