import { H } from "./_y.js";
export default async function handler(req, res) {
  const q = String(req.query.q || "").trim().slice(0, 40);
  if (q.length < 2) return res.status(200).json({ results: [] });
  try {
    const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&lang=en-US&region=IN`;
    const x = await fetch(u, { headers: H });
    if (!x.ok) throw new Error("upstream " + x.status);
    const j = await x.json();
    const results = (j.quotes || [])
      .filter((r) => ["EQUITY", "ETF", "INDEX"].includes(r.quoteType) && r.symbol)
      .map((r) => ({ symbol: r.symbol, name: r.longname || r.shortname || r.symbol, exch: r.exchDisp || "", sector: r.sector || r.industry || "" }));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ results });
  } catch (e) { res.status(502).json({ error: String(e.message) }); }
}
