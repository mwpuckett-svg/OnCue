// Fetches a public Google Sheet tab as CSV for OnCue. Runs on Vercel (and in `npm run dev` through vite.config.js).
// The browser can't read Google's export link directly, so it asks this endpoint instead.
// GET /api/sheet?id=<sheet id>&gid=<tab id>  ->  { csv } or { error }

const ID_RE = /^[A-Za-z0-9_-]{20,80}$/;
const GID_RE = /^\d{1,12}$/;
const MAX_BYTES = 2 * 1024 * 1024;

function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id") || "";
  const gid = url.searchParams.get("gid") || "0";
  if (!ID_RE.test(id) || !GID_RE.test(gid)) return send(res, 400, { error: "bad-request", message: "That doesn't look like a Google Sheets link." });

  try {
    const target = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    const r = await fetch(target, { redirect: "follow", headers: { Accept: "text/csv" } });
    const type = r.headers.get("content-type") || "";
    if (r.status === 404) return send(res, 404, { error: "not-found", message: "Google couldn't find that sheet or tab." });
    if (!r.ok || !type.includes("csv")) {
      // A private sheet answers with Google's sign-in page instead of data.
      return send(res, 403, { error: "private", message: "The sheet isn't shared. In Google Sheets choose Share, then General access: Anyone with the link (Viewer)." });
    }
    const csv = await r.text();
    if (csv.length > MAX_BYTES) return send(res, 413, { error: "too-big", message: "That tab is too large to import." });
    // Short edge cache so a crew all refreshing together makes one request to Google, not twenty.
    return send(res, 200, { csv }, "public, s-maxage=8, stale-while-revalidate=15");
  } catch {
    return send(res, 502, { error: "unreachable", message: "Couldn't reach Google Sheets. Check the connection and try again." });
  }
}
