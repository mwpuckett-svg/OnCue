// Browser side of the Google Sheet link: asks OnCue's /api/sheet for a tab's CSV.
export async function fetchSheetCsv(id, gid) {
  let r;
  try {
    r = await fetch(`/api/sheet?id=${encodeURIComponent(id)}&gid=${encodeURIComponent(gid || "0")}`);
  } catch {
    throw new Error("Couldn't reach the OnCue server to read the sheet. Check the connection and try again.");
  }
  let body = {};
  try { body = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || body.error || typeof body.csv !== "string") throw new Error(body.message || "Couldn't read the sheet.");
  return body.csv;
}
