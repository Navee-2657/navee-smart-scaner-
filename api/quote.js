import { chart, okSym } from "./_y.js";
const M = { "1D": ["1d", "5m"], "1W": ["5d", "30m"], "1M": ["1mo", "1d"], "6M": ["6mo", "1d"], "1Y": ["1y", "1d"], "5Y": ["5y", "1wk"] };
export default async function handler(req, res) {
  const s = String(req.query.s || "").trim(), rg = req.query.range || "1M";
  if (!okSym(s)) return res.status(400).json({ error: "bad symbol" });
  const [r, i] = M[rg] || M["1M"];
  try {
    const [R, D1] = await Promise.all([chart(s, r, i), rg === "1D" ? null : chart(s, "1d", "5m")]);
    const d = D1 || R, m = R.meta, dm = d.meta, dq = d.indicators.quote[0];
    const pts = R.timestamp.map((t, k) => [t, R.indicators.quote[0].close[k]]).filter((p) => p[1] != null);
    const open = (dq.open || []).find((v) => v != null);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(200).json({
      meta: { price: dm.regularMarketPrice, prev: dm.chartPreviousClose, hi: m.fiftyTwoWeekHigh, lo: m.fiftyTwoWeekLow, dh: dm.regularMarketDayHigh, dl: dm.regularMarketDayLow, vol: dm.regularMarketVolume, open, currency: m.currency, name: m.longName || m.shortName, exchange: m.fullExchangeName },
      ts: pts.map((p) => p[0]), v: pts.map((p) => p[1]),
    });
  } catch (e) { res.status(502).json({ error: String(e.message) }); }
}
