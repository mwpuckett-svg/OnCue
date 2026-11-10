// Run with: node scripts/test-sheetSync.mjs
import assert from "node:assert/strict";
import { readSheet, planSync, resolveColumns, extractSheetRef, parseClock, parseLength, parseCsv } from "../src/lib/sheetSync.js";

const csv = [
  ",,,,,,,,,,,",
  "Run of Show,,,,Event Name,,,,,,,",
  ",,,,Event Time,,,,,,,",
  ",,,,Location,,,,,,,",
  ",,,,,,,,,,,",
  "CUE,TIME,LENGTH,PROGRAM,,,AUDIO,MICs,VIDEO,GFX,LIGHTING,NOTES",
  '101,8:00: AM,0:10,"TITLE\n\nAllison Clark",,,Walk-in music up,LAV 1,Roll opener,Lower third,House to half,Hold for stragglers',
  '102,8:10: AM,0:20,"Welcome\n\nVictoria Huffman",,,,Handheld,,,,',
  "103,8:30: AM,0:20,,,,,,,,,",
  '104,8:50: AM,0:15,"Keynote\n\nWilliam V.",,,Playback in,,Slides,,Spot on,"Q&A after, ""no"" cut"',
  "105,9:05: AM,0:20,,,,,,,,,",
].join("\r\n");

// parsing helpers
assert.equal(parseClock("8:00: AM"), 480);
assert.equal(parseClock("12:10: AM"), 10);
assert.equal(parseClock("12:30: PM"), 750);
assert.equal(parseClock("7 PM"), 1140);
assert.equal(parseClock("20:30"), 1230);
assert.equal(parseClock("nope"), null);
assert.equal(parseLength("0:20", "hm"), 1200);
assert.equal(parseLength("0:20", "ms"), 20);
assert.equal(parseLength("12:30", "ms"), 750);
assert.equal(parseLength("1:02:03"), 3723);
assert.equal(parseLength("20 min"), 1200);
assert.equal(parseLength(""), null);
assert.deepEqual(extractSheetRef("https://docs.google.com/spreadsheets/d/1cLAHdKJ7iBwC835fSEpgAlWXfeuVKUKn7ocQy5ANWt0/edit?usp=drive_link"), { id: "1cLAHdKJ7iBwC835fSEpgAlWXfeuVKUKn7ocQy5ANWt0", gid: "0" });
assert.equal(extractSheetRef("https://docs.google.com/spreadsheets/d/1cLAHdKJ7iBwC835fSEpgAlWXfeuVKUKn7ocQy5ANWt0/edit#gid=1234").gid, "1234");
assert.equal(extractSheetRef("https://example.com/x"), null);
assert.equal(parseCsv('a,"b\nc",d\n1,2,3').length, 2);

// reading
const p = readSheet(csv);
assert.ok(p.ok, p.error);
assert.equal(p.headerRow, 6);
assert.equal(p.lengthFormat, "hm", "0:20 lengths line up with 20-minute TIME steps, so h:mm");
assert.equal(p.startTime, "08:00");
assert.deepEqual(p.deptHeaders, ["AUDIO", "MICs", "VIDEO", "GFX", "LIGHTING"]);
assert.equal(p.cues.length, 3, "blank rows are skipped");
assert.equal(p.skipped, 2);
const [c1, c2, c4] = p.cues;
assert.equal(c1.key, "c:101");
assert.equal(c1.name, "TITLE");
assert.equal(c1.owner, "Allison Clark");
assert.equal(c1.durationSec, 600);
assert.equal(c1.notes, "Hold for stragglers");
assert.equal(c1.dept.AUDIO, "Walk-in music up");
assert.equal(c2.owner, "Victoria Huffman");
assert.equal(c4.durationSec, 900);
assert.equal(c4.notes, 'Q&A after, "no" cut');

assert.ok(p.warnings.some((w) => w.includes("different time")), "a gap in the sheet's TIMEs is flagged");
assert.equal(readSheet(csv.replace("8:50: AM", "8:30: AM")).warnings.length, 0, "matching TIMEs give no warning");

// forced format
assert.equal(readSheet(csv, { lengthFormat: "ms" }).cues[0].durationSec, 10);

// bad sheets
assert.equal(readSheet("").ok, false);
assert.equal(readSheet("a,b\n1,2").ok, false);
assert.equal(readSheet("<html>sign in</html>").ok, false);

// columns map onto OnCue's positions
const positions = [
  { id: "p-aud", label: "Audio" }, { id: "p-lx", label: "Lighting" }, { id: "p-vid", label: "Video / AV" }, { id: "p-sm", label: "Stage Manager" },
];
const cols = resolveColumns(p.deptHeaders, positions);
const by = Object.fromEntries(cols.map((c) => [c.header, c]));
assert.equal(by.AUDIO.positionId, "p-aud");
assert.equal(by.LIGHTING.positionId, "p-lx");
assert.equal(by.VIDEO.positionId, "p-vid");
assert.equal(by.GFX.action, "new");
assert.equal(by.GFX.label, "Graphics");
assert.equal(by.MICs.label, "Mics");
assert.equal(resolveColumns(["GFX"], positions, { GFX: "skip" })[0].action, "skip");
assert.equal(resolveColumns(["GFX"], positions, { GFX: "p-sm" })[0].positionId, "p-sm");

// first sync into an empty day
const full = cols.map((c) => ({ ...c, positionId: c.positionId || `new-${c.header}` }));
let day = { startTime: "18:00", sheetStart: null, cues: [] };
let plan = planSync({ parsed: p, day, columns: full });
assert.equal(plan.insert.length, 3);
assert.equal(plan.dayPatch.start_time, "08:00");
assert.equal(plan.noteWants.length, 3 * 5);
assert.equal(plan.noteWants.find((n) => n.cueKey === "c:101" && n.header === "AUDIO").text, "Walk-in music up");

// day as it looks after that sync
const synced = p.cues.map((c, i) => ({
  id: `id${i}`, sortOrder: i, sheetKey: c.key, actualStart: null,
  sheetSnapshot: { name: c.name, durationSec: c.durationSec, owner: c.owner, notes: c.notes },
  name: c.name, durationSec: c.durationSec, owner: c.owner, notes: c.notes,
}));
day = { startTime: "08:00", sheetStart: "08:00", cues: synced };
plan = planSync({ parsed: p, day, columns: full });
assert.ok(plan.isEmpty, "syncing an unchanged sheet changes nothing");

// the sheet changes one cell; a local edit to a different field survives
const edited = readSheet(csv.replace("Welcome", "Welcome Back"), { lengthFormat: "hm" });
day.cues[0].name = "TITLE (edited in OnCue)";           // local tweak, sheet untouched
day.cues[1].notes = "Local note";                       // local tweak on a cue whose sheet cell changes elsewhere
plan = planSync({ parsed: edited, day, columns: full });
assert.equal(plan.update.length, 1);
assert.deepEqual(plan.update[0].patch, { name: "Welcome Back" });
assert.equal(plan.update[0].id, "id1");
assert.equal(plan.insert.length + plan.remove.length, 0);

// a row moves in the sheet: order changes, no duplicate cue
const lines = csv.split("\r\n");
const swapped = [...lines.slice(0, 6), lines[7], lines[6], ...lines.slice(8)].join("\r\n");
plan = planSync({ parsed: readSheet(swapped, { lengthFormat: "hm" }), day: { ...day, cues: synced.map((c) => ({ ...c })) }, columns: full });
assert.equal(plan.insert.length, 0);
assert.equal(plan.remove.length, 0);
assert.deepEqual(plan.update.map((u) => [u.id, u.patch.sort_order]).sort(), [["id0", 1], ["id1", 0]]);

// a row is deleted in the sheet; one that already ran live is kept
const without = csv.split("\r\n").filter((l) => !l.startsWith("102,") && !l.startsWith("104,")).join("\r\n");
const ranLive = synced.map((c) => ({ ...c, actualStart: c.sheetKey === "c:104" ? 1 : null }));
plan = planSync({ parsed: readSheet(without, { lengthFormat: "hm" }), day: { ...day, cues: ranLive }, columns: full });
assert.deepEqual(plan.remove, ["id1"]);
assert.equal(plan.keptRun, 1);

// a cue added by hand stays, after the sheet's cues
const manual = [...synced, { id: "hand", sortOrder: 9, sheetKey: null, actualStart: null, sheetSnapshot: null }];
plan = planSync({ parsed: p, day: { ...day, cues: manual }, columns: full });
assert.equal(plan.remove.length, 0);
assert.deepEqual(plan.update.map((u) => [u.id, u.patch.sort_order]), [["hand", 3]]);

// no CUE column: rows are matched by program name
const noKey = readSheet("TIME,LENGTH,PROGRAM\n8:00 AM,10:00,Opener\n8:10 AM,10:00,Opener\n", { lengthFormat: "ms" });
assert.deepEqual(noKey.cues.map((c) => c.key), ["n:opener", "n:opener#2"]);

console.log("sheetSync: all checks passed");
