// Reads a Google Sheet (as CSV) into cues, and works out what needs to change in a day to match it.
// Everything here is plain functions with no network or database calls, so it can be tested on its own.

/* ---------- link ---------- */

/** Pulls the sheet id and tab (gid) out of any Google Sheets link. */
export function extractSheetRef(url) {
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url || "");
  if (!m) return null;
  const g = /[#?&]gid=(\d+)/.exec(url);
  return { id: m[1], gid: g ? g[1] : "0" };
}

export const sheetUrl = (id, gid) => `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? `#gid=${gid}` : ""}`;

/* ---------- csv ---------- */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Small, stable fingerprint of the sheet text, used to notice when anything changed. */
export function hashText(s) {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}.${s.length}`;
}

/* ---------- times and lengths ---------- */

/** "8:00 AM", "8:00: AM", "8 PM", "20:30", "8:00:00 AM" to minutes after midnight. */
export function parseClock(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*:?\s*([ap])\.?m?\.?$/i.exec(s);
  let h, min, mer;
  if (m) { h = +m[1]; min = +m[2]; mer = m[3].toLowerCase(); }
  else if ((m = /^(\d{1,2})\s*([ap])\.?m?\.?$/i.exec(s))) { h = +m[1]; min = 0; mer = m[2].toLowerCase(); }
  else if ((m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s))) { h = +m[1]; min = +m[2]; mer = null; }
  else return null;
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (mer === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + min;
}

export const clockToTimeStr = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const twoPart = (s) => /^\s*\d+:\d{2}\s*$/.test(s);

/**
 * Length cells to seconds.
 * "h:mm" and "m:ss" look the same, so for two-part values the caller says which one the sheet uses.
 * Three-part values are always h:mm:ss. "20 min", "45s" and a plain number (minutes) also work.
 */
export function parseLength(raw, format = "hm") {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d+):(\d{2}):(\d{2})$/.exec(s);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  if ((m = /^(\d+):(\d{2})$/.exec(s))) return format === "ms" ? +m[1] * 60 + +m[2] : +m[1] * 3600 + +m[2] * 60;
  if ((m = /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)$/i.exec(s))) return Math.round(parseFloat(m[1]) * 60);
  if ((m = /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)$/i.exec(s))) return Math.round(parseFloat(m[1]));
  if ((m = /^(\d+(?:\.\d+)?)$/.exec(s))) return Math.round(parseFloat(m[1]) * 60);
  return null;
}

/** Works out whether "0:20" means 20 minutes (hm) or 20 seconds (ms) by checking it against the TIME column. */
export function detectLengthFormat(rows) {
  let hm = 0, ms = 0, seen = 0, bigFirst = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!twoPart(r.length)) continue;
    seen++;
    const [a, b] = r.length.trim().split(":").map(Number);
    if (a >= 6) bigFirst = true;
    const next = rows.slice(i + 1).find((x) => x.timeMin != null);
    if (r.timeMin == null || !next) continue;
    const delta = (next.timeMin - r.timeMin + 1440) % 1440;
    if (Math.abs(delta - (a * 60 + b)) < 0.5) hm++;
    if (Math.abs(delta - (a + b / 60)) < 0.5) ms++;
  }
  if (hm > ms) return "hm";
  if (ms > hm) return "ms";
  if (!seen) return "hm";
  return bigFirst ? "ms" : "ms";
}

/* ---------- reading the sheet ---------- */

const FIELD_NAMES = {
  key: ["cue", "cue #", "cue no", "cue number", "cue id", "#", "no", "id"],
  time: ["time", "start", "start time", "clock"],
  length: ["length", "duration", "dur", "run time", "runtime", "trt"],
  name: ["program", "segment", "item", "title", "name", "description", "content", "element"],
  presenter: ["presenter", "speaker", "talent", "owner", "who", "host"],
  notes: ["notes", "note", "comments", "remarks"],
};

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9# ]+/g, " ").replace(/\s+/g, " ").trim();
const fieldOf = (header) => {
  const n = norm(header);
  if (!n) return null;
  return Object.keys(FIELD_NAMES).find((f) => FIELD_NAMES[f].includes(n)) || null;
};

const cleanCell = (s) => String(s ?? "").replace(/\r/g, "").trim();

/**
 * @returns {{ ok: false, error: string } | { ok: true, headerRow:number, lengthFormat:string, detectedFormat:string,
 *   startTime:string|null, deptHeaders:string[], cues:Array, skipped:number, warnings:string[] }}
 */
export function readSheet(csvText, { lengthFormat = "auto" } = {}) {
  const grid = parseCsv(csvText);
  if (!grid.length) return { ok: false, error: "The sheet came back empty." };

  // Find the header row: the first one with a program/name column plus a length or time column.
  let headerIdx = -1, cols = null;
  for (let r = 0; r < Math.min(grid.length, 60); r++) {
    const found = {};
    grid[r].forEach((cell, c) => { const f = fieldOf(cell); if (f && found[f] === undefined) found[f] = c; });
    if (found.name !== undefined && (found.length !== undefined || found.time !== undefined)) { headerIdx = r; cols = found; break; }
  }
  if (headerIdx < 0) return { ok: false, error: "Couldn't find the header row. It needs a PROGRAM (or Segment/Title) column and a LENGTH or TIME column." };

  const headerCells = grid[headerIdx];
  const usedCols = new Set(Object.values(cols));
  const deptHeaders = [];
  const deptCols = [];
  headerCells.forEach((cell, c) => {
    const h = cleanCell(cell);
    if (!h || usedCols.has(c) || c < cols.name) return;
    if (deptCols.some((d) => norm(d.header) === norm(h))) return;
    deptHeaders.push(h);
    deptCols.push({ header: h, c });
  });

  // First pass: raw rows.
  const raw = [];
  let skipped = 0;
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    const get = (c) => (c === undefined ? "" : cleanCell(row[c]));
    const nameCell = get(cols.name);
    const dept = {};
    deptCols.forEach(({ header, c }) => { const t = get(c); if (t) dept[header] = t; });
    const notes = get(cols.notes);
    const presenterCell = get(cols.presenter);
    if (!nameCell && !notes && !presenterCell && !Object.keys(dept).length) { skipped++; continue; }
    raw.push({ line: r + 1, key: get(cols.key), time: get(cols.time), timeMin: parseClock(get(cols.time)), length: get(cols.length), nameCell, presenterCell, notes, dept });
  }

  const detectedFormat = detectLengthFormat(raw);
  const format = lengthFormat === "hm" || lengthFormat === "ms" ? lengthFormat : detectedFormat;

  const warnings = [];
  const seenKeys = new Map();
  const cues = raw.map((x, i) => {
    // The program cell can carry the presenter on the lines under the title (TITLE / Presenter).
    const lines = x.nameCell.split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines[0] || "Untitled cue";
    const owner = x.presenterCell || lines.slice(1).join(", ");
    let durationSec = parseLength(x.length, format);
    if (durationSec == null) { durationSec = 300; warnings.push(`Row ${x.line} has no readable length${x.length ? ` ("${x.length}")` : ""}, so it was set to 5:00.`); }
    // Stable id for the row: the CUE number when there is one, otherwise the program name.
    const base = x.key ? `c:${x.key}` : `n:${norm(name)}`;
    const n = (seenKeys.get(base) || 0) + 1;
    seenKeys.set(base, n);
    return { key: n > 1 ? `${base}#${n}` : base, line: x.line, name, durationSec, owner, notes: x.notes, dept: x.dept, timeMin: x.timeMin, index: i };
  });

  // OnCue works start times out from the lengths. Say so when that disagrees with the sheet's own TIME column.
  const first = cues.find((c) => c.timeMin != null);
  if (first) {
    let t = first.timeMin;
    let off = 0;
    cues.forEach((c) => { if (c.timeMin != null && (c.timeMin - t + 1440) % 1440 !== 0) off++; t = (t + Math.round(c.durationSec / 60)) % 1440; });
    if (off) warnings.push(`${off} ${off === 1 ? "cue starts" : "cues start"} at a different time than the sheet's TIME column, because OnCue adds up the lengths. Give a cue a hard time in OnCue if it has to land on the sheet's time.`);
  }
  return {
    ok: true, headerRow: headerIdx + 1, lengthFormat: format, detectedFormat,
    startTime: first ? clockToTimeStr(first.timeMin) : null,
    deptHeaders, cues, skipped, warnings,
    hasPresenterColumn: cols.presenter !== undefined,
  };
}

/* ---------- crew columns to positions ---------- */

// Sheet shorthand written the way OnCue names its positions.
const LABEL_ALIASES = { gfx: "Graphics", graphics: "Graphics", av: "Video / AV", mics: "Mics", mic: "Mics", lx: "Lighting", lights: "Lighting", fx: "FX", pyro: "Pyro" };

export function titleCaseHeader(h) {
  const alias = LABEL_ALIASES[norm(h)];
  if (alias) return alias;
  return h === h.toUpperCase() && h.length > 4 ? h.charAt(0) + h.slice(1).toLowerCase() : h;
}

/**
 * Decides which crew position each extra column (AUDIO, VIDEO, ...) feeds.
 * saved: { [header]: positionId | "skip" } from an earlier link. Anything else is matched by name, or marked as new.
 * @returns {Array<{ header:string, positionId:string|null, action:"existing"|"new"|"skip", label:string }>}
 */
export function resolveColumns(deptHeaders, positions, saved = {}) {
  return deptHeaders.map((header) => {
    const keep = saved[header];
    if (keep === "skip") return { header, positionId: null, action: "skip", label: header };
    const savedPos = keep && positions.find((p) => p.id === keep);
    if (savedPos) return { header, positionId: savedPos.id, action: "existing", label: savedPos.label };
    const n = norm(titleCaseHeader(header));
    const hit = positions.find((p) => norm(p.label) === n)
      || positions.find((p) => { const pl = norm(p.label); return n.length >= 3 && (pl.split(" ").includes(n) || pl.startsWith(n) || n.startsWith(pl)); });
    if (hit) return { header, positionId: hit.id, action: "existing", label: hit.label };
    return { header, positionId: null, action: "new", label: titleCaseHeader(header) };
  });
}

/* ---------- plan ---------- */

const FIELDS = ["name", "durationSec", "owner", "notes"];
const COLUMN = { name: "name", durationSec: "duration_sec", owner: "owner", notes: "notes" };

/**
 * Compares the sheet with the day as it is now.
 * A field is only overwritten when the sheet's value for it changed since the last sync, so a tweak made in OnCue
 * stays put until someone edits that same cell in the sheet.
 *
 * @param parsed   result of readSheet (ok)
 * @param day      { startTime, sheetStart, cues: [{ id, sortOrder, sheetKey, sheetSnapshot, actualStart, roleNotes }] }
 * @param columns  result of resolveColumns, with positionId filled in for every non-skipped column
 */
export function planSync({ parsed, day, columns }) {
  const existingByKey = new Map(day.cues.filter((c) => c.sheetKey).map((c) => [c.sheetKey, c]));
  const sheetKeys = new Set(parsed.cues.map((c) => c.key));

  const insert = [];
  const update = [];
  parsed.cues.forEach((sc, i) => {
    const snap = { name: sc.name, durationSec: sc.durationSec, owner: sc.owner, notes: sc.notes };
    const ex = existingByKey.get(sc.key);
    if (!ex) { insert.push({ key: sc.key, sortOrder: i, snapshot: snap, ...snap }); return; }
    const prev = ex.sheetSnapshot || {};
    const patch = {};
    FIELDS.forEach((f) => { if (prev[f] !== snap[f]) patch[COLUMN[f]] = snap[f]; });
    if (ex.sortOrder !== i) patch.sort_order = i;
    const snapChanged = FIELDS.some((f) => prev[f] !== snap[f]);
    if (Object.keys(patch).length || snapChanged) update.push({ id: ex.id, key: sc.key, patch, snapshot: snap, changedFields: FIELDS.filter((f) => prev[f] !== snap[f]) });
  });

  // Cues that came from the sheet but aren't in it any more. Ones already run on the live show are kept.
  const gone = day.cues.filter((c) => c.sheetKey && !sheetKeys.has(c.sheetKey));
  const remove = gone.filter((c) => !c.actualStart).map((c) => c.id);
  const kept = gone.filter((c) => c.actualStart);

  // Cues added by hand and cues kept for the record go after the sheet's cues.
  let next = parsed.cues.length;
  [...day.cues.filter((c) => !c.sheetKey), ...kept]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((c) => { if (c.sortOrder !== next) update.push({ id: c.id, key: c.sheetKey || null, patch: { sort_order: next }, snapshot: null, orderOnly: true }); next++; });

  // Crew notes: the text of each AUDIO/VIDEO/... cell, per cue and position.
  const noteWants = [];
  parsed.cues.forEach((sc) => {
    columns.filter((c) => c.action !== "skip" && c.positionId !== undefined).forEach((col) => {
      noteWants.push({ cueKey: sc.key, header: col.header, positionId: col.positionId, text: sc.dept[col.header] || "" });
    });
  });

  const dayPatch = {};
  if (parsed.startTime && parsed.startTime !== (day.sheetStart || null)) dayPatch.start_time = parsed.startTime;

  const changedCount = update.filter((u) => !u.orderOnly && u.changedFields && u.changedFields.length).length;
  return {
    insert, update, remove, keptRun: kept.length, noteWants, dayPatch,
    summary: { added: insert.length, changed: changedCount, removed: remove.length, total: parsed.cues.length },
    isEmpty: !insert.length && !update.length && !remove.length && !Object.keys(dayPatch).length,
  };
}
