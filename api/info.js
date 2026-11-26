import { summary, okSym } from "./_y.js";
const r = (o) => (o && typeof o.raw === "number" ? o.raw : null);
export default async function handler(req, res) {
  const s = String(req.query.s || "").trim();
  if (!okSym(s)) return res.status(400).json({ error: "bad symbol" });
  try {
    const R = await summary(s, "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile,calendarEvents");
    const p = R.price || {}, sd = R.summaryDetail || {}, ks = R.defaultKeyStatistics || {}, fd = R.financialData || {}, ap = R.assetProfile || {}, ce = R.calendarEvents || {};
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    res.status(200).json({
      name: p.longName || p.shortName || null, cur: p.currency || null,
      sector: ap.sector || null, industry: ap.industry || null,
      mcap: r(p.marketCap), pe: r(sd.trailingPE), fpe: r(sd.forwardPE), dy: r(sd.dividendYield), beta: r(sd.beta), avgVol: r(sd.averageVolume),
      eps: r(ks.trailingEps), pb: r(ks.priceToBook), roe: r(fd.returnOnEquity), margin: r(fd.profitMargins),
      earnings: ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate[0] ? r(ce.earnings.earningsDate[0]) : null,
      exDiv: r(ce.exDividendDate), divDate: r(ce.dividendDate),
    });
  } catch (e) { res.status(502).json({ error: String(e.message) }); }
}
