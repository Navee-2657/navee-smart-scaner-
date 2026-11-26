import { chart, okSym } from "./_y.js";
export default async function handler(req, res) {
  const syms = String(req.query.s || "").split(",").map((x) => x.trim()).filter(okSym).slice(0, 40);
  const out = {};
  await Promise.all(syms.map(async (s) => {
    try { const m = (await chart(s, "1d", "1d")).meta; out[s] = { price: m.regularMarketPrice, prev: m.chartPreviousClose }; } catch (e) {}
  }));
  if (!Object.keys(out).length) return res.status(502).json({ error: "no quotes" });
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
  res.status(200).json(out);
}
