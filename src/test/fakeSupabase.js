// Test-only stand-in for the Supabase client: an in-memory database with the handful of query methods OnCue uses.
// Used by sheettest.html (see vite.sheettest.config.js) so the real data hook can be exercised without a network.

const db = {
  projects: [{ id: "proj1", name: "The Big Night", venue: "", date: null }],
  positions: [
    { id: "p-sm", project_id: "proj1", label: "Stage Manager", color: "#C8452B", is_admin: true, sort_order: 0 },
    { id: "p-aud", project_id: "proj1", label: "Audio", color: "#C99A1A", is_admin: false, sort_order: 1 },
    { id: "p-vid", project_id: "proj1", label: "Video / AV", color: "#2E8B6E", is_admin: false, sort_order: 2 },
    { id: "p-lx", project_id: "proj1", label: "Lighting", color: "#BE4B7A", is_admin: false, sort_order: 3 },
  ],
  project_members: [{ id: "m1", project_id: "proj1", user_id: "u1", position_id: "p-sm", is_guest: false, display_name: "Mike" }],
  invites: [],
  days: [{ id: "d1", project_id: "proj1", label: "Day 1", date: null, start_time: "18:00", target_end: "", sort_order: 0, sheet_length_format: "hm", sheet_map: {} }],
  cues: [],
  cue_notes: [],
};
let seq = 1;
const uid = () => `id-${seq++}`;
export const __db = db;
if (typeof window !== "undefined") window.__db = db;

const UNIQUE = { cues: ["day_id", "sheet_key"] };
const clone = (x) => JSON.parse(JSON.stringify(x));

class Query {
  constructor(table) { this.table = table; this.op = "select"; this.filters = []; this.returning = false; this.one = false; this.payload = null; this.opts = {}; }
  select() { if (this.op !== "select") this.returning = true; return this; }
  insert(p) { this.op = "insert"; this.payload = [].concat(p); return this; }
  upsert(p, opts = {}) { this.op = "upsert"; this.payload = [].concat(p); this.opts = opts; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.filters.push((r) => this.val(r, c) === v); return this; }
  neq(c, v) { this.filters.push((r) => this.val(r, c) !== v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(this.val(r, c))); return this; }
  or(expr) {
    const tests = expr.split(",").map((part) => {
      const [col, op, ...rest] = part.split(".");
      const v = rest.join(".");
      if (op === "is" && v === "null") return (r) => r[col] == null;
      if (op === "neq") return (r) => r[col] !== v;
      if (op === "eq") return (r) => r[col] === v;
      throw new Error("fake supabase: unsupported or() " + part);
    });
    this.filters.push((r) => tests.some((t) => t(r)));
    return this;
  }
  order() { return this; }
  single() { this.one = true; return this; }
  // "cues.day_id" filters on cue_notes look through to the cue.
  val(r, c) {
    if (c.includes(".")) {
      const [t, col] = c.split(".");
      if (t === "cues" && this.table === "cue_notes") return db.cues.find((x) => x.id === r.cue_id)?.[col];
      if (t === "days" && this.table === "cues") return db.days.find((x) => x.id === r.day_id)?.[col];
      throw new Error("fake supabase: unsupported join " + c);
    }
    return r[c];
  }
  run() {
    const t = db[this.table];
    if (!t) return { data: null, error: { message: `no table ${this.table}` } };
    const match = (r) => this.filters.every((f) => f(r));
    const uniq = UNIQUE[this.table];
    const conflict = (row, ignore) => uniq && row[uniq[1]] != null && t.some((r) => r !== ignore && r[uniq[0]] === row[uniq[0]] && r[uniq[1]] === row[uniq[1]]);
    let out = [];
    if (this.op === "select") out = t.filter(match).map(clone);
    else if (this.op === "insert") {
      for (const p of this.payload) {
        if (conflict(p)) return { data: null, error: { message: `duplicate key value violates unique constraint "${this.table}_${uniq[1]}_unique"` } };
        const row = { id: uid(), ...clone(p) };
        t.push(row); out.push(clone(row));
      }
    } else if (this.op === "upsert") {
      for (const p of this.payload) {
        const hit = uniq && p[uniq[1]] != null ? t.find((r) => r[uniq[0]] === p[uniq[0]] && r[uniq[1]] === p[uniq[1]]) : null;
        if (hit) { Object.assign(hit, clone(p)); out.push(clone(hit)); } else { const row = { id: uid(), ...clone(p) }; t.push(row); out.push(clone(row)); }
      }
    } else if (this.op === "update") {
      t.filter(match).forEach((r) => { Object.assign(r, clone(this.payload)); out.push(clone(r)); });
    } else if (this.op === "delete") {
      const gone = t.filter(match);
      gone.forEach((r) => t.splice(t.indexOf(r), 1));
      if (this.table === "cues") gone.forEach((c) => { for (let i = db.cue_notes.length - 1; i >= 0; i--) if (db.cue_notes[i].cue_id === c.id) db.cue_notes.splice(i, 1); });
      out = gone.map(clone);
    }
    const wantsRows = this.op === "select" || this.returning;
    if (this.one) return { data: out[0] || null, error: out[0] ? null : { message: "no rows" } };
    return { data: wantsRows ? out : null, error: null };
  }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
}

const channel = { on() { return channel; }, subscribe() { return channel; } };
export const supabase = {
  from: (t) => new Query(t),
  channel: () => channel,
  removeChannel() {},
};
export const supabaseConfigured = true;
