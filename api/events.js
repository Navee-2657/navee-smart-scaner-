const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Accept: "application/json, text/plain, */*" };
const NQ = { ...UA, Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };
const nq = async (p) => {
  const x = await fetch("https://api.nasdaq.com/api/" + p, { headers: NQ, signal: AbortSignal.timeout(7000) });
  if (!x.ok) throw new Error("nasdaq " + x.status);
  return (await x.json()).data || {};
};
const ds = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const ts = (s) => { const t = Date.parse(s); return isNaN(t) ? null : Math.floor(t / 1000); };
const mc = (s) => Number(String(s || "").replace(/[^0-9.]/g, "")) || 0;
const ok = (r) => (r.status === "fulfilled" ? r.value : []);

async function earnings() {
  const days = await Promise.allSettled([1, 2, 3, 4].map((n) => nq("calendar/earnings?date=" + ds(n)).then((d) => (d.rows || []).map((r) => ({ r, n })))));
  return days.flatMap(ok).sort((a, b) => mc(b.r.marketCap) - mc(a.r.marketCap)).slice(0, 10)
    .map(({ r, n }) => ({ t: "Results", h: (r.name || r.symbol) + " earnings", date: ts(ds(n)), sym: r.symbol }));
}
async function dividends() {
  const days = await Promise.allSettled([1, 2, 3].map((n) => nq("calendar/dividends?date=" + ds(n)).then((d) => ((d.calendar || d).rows || []).map((r) => ({ r, n })))));
  return days.flatMap(ok).sort((a, b) => mc(b.r.dividend_Rate) - mc(a.r.dividend_Rate)).slice(0, 8)
    .map(({ r, n }) => ({ t: "Dividend", h: (r.companyName || r.symbol) + " dividend " + (r.dividend_Rate ? "$" + r.dividend_Rate : ""), date: ts(r.dividend_Ex_Date) || ts(ds(n)), sym: r.symbol }));
}
async function splits() {
  const days = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7].map((n) => nq("calendar/splits?date=" + ds(n)).then((d) => d.rows || [])));
  return days.flatMap(ok).slice(0, 6).map((r) => ({ t: "Split", h: (r.name || r.symbol) + " split " + (r.ratio || ""), date: ts(r.executionDate || r.payableDate), sym: r.symbol }));
}
async function ipos() {
  const ms = await Promise.allSettled([0, 31].map((n) => nq("ipo/calendar?date=" + ds(n).slice(0, 7)).then((d) => (d.upcoming && d.upcoming.upcomingTable && d.upcoming.upcomingTable.rows) || [])));
  return ms.flatMap(ok).slice(0, 10).map((r) => ({ t: "IPO", h: (r.companyName || "New listing") + " IPO" + (r.proposedSharePrice ? " at $" + r.proposedSharePrice : ""), date: ts(r.expectedPriceDate), sym: r.proposedTickerSymbol || null }));
}
async function nse() {
  const h0 = await fetch("https://www.nseindia.com", { headers: { ...UA, Accept: "text/html" }, signal: AbortSignal.timeout(7000) });
  const raw = h0.headers.getSetCookie ? h0.headers.getSetCookie() : [h0.headers.get("set-cookie") || ""];
  const cookie = raw.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const x = await fetch("https://www.nseindia.com/api/corporates-corporateActions?index=equities", { headers: { ...UA, Referer: "https://www.nseindia.com/companies-listing/corporate-filings-actions", Cookie: cookie }, signal: AbortSignal.timeout(8000) });
  if (!x.ok) throw new Error("nse " + x.status);
  const rows = await x.json(), now = Date.now() / 1000 - 864e2, out = [];
  for (const r of rows) {
    const s = String(r.subject || ""), d = ts(r.exDate);
    const t = /bonus/i.test(s) ? "Bonus" : /split|sub-?division/i.test(s) ? "Split" : /rights/i.test(s) ? "Rights" : /dividend/i.test(s) ? "Dividend" : null;
    if (t && d && d >= now) out.push({ t, h: (r.comp || r.symbol) + " " + s.slice(0, 50), date: d, sym: r.symbol + ".NS" });
  }
  return out.sort((a, b) => a.date - b.date).slice(0, 16);
}
export default async function handler(req, res) {
  const parts = await Promise.allSettled([earnings(), dividends(), splits(), ipos(), nse()]);
  const now = Date.now() / 1000 - 864e2;
  const events = parts.flatMap(ok).filter((e) => e.date && e.date >= now).sort((a, b) => a.date - b.date).slice(0, 40);
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  res.status(200).json({ events });
}
