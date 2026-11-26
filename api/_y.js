export const H = { "User-Agent": "Mozilla/5.0 (compatible; SmartScanner/1.0)", Accept: "application/json" };
export async function chart(s, range, interval) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${range}&interval=${interval}`;
  const x = await fetch(u, { headers: H });
  if (!x.ok) throw new Error("upstream " + x.status);
  const j = await x.json();
  const R = j.chart && j.chart.result && j.chart.result[0];
  if (!R) throw new Error("no data");
  return R;
}
export const okSym = (s) => /^[\w.^=\-&]{1,24}$/.test(s);
let CK = null;
async function auth() {
  if (CK && Date.now() - CK.t < 36e5) return CK;
  const r = await fetch("https://fc.yahoo.com", { headers: H, redirect: "manual" });
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie") || ""];
  const cookie = raw.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const c = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { ...H, Cookie: cookie } });
  const crumb = await c.text();
  if (!c.ok || !crumb || crumb.includes("<")) throw new Error("crumb");
  return (CK = { cookie, crumb, t: Date.now() });
}
export async function summary(s, mods) {
  const a = await auth();
  const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=${mods}&crumb=${encodeURIComponent(a.crumb)}`;
  const x = await fetch(u, { headers: { ...H, Cookie: a.cookie } });
  if (!x.ok) { CK = null; throw new Error("summary " + x.status); }
  const j = await x.json();
  return j.quoteSummary.result[0];
}
