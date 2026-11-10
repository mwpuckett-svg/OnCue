// Run before shipping any update:  npm run bump -- "What changed, in plain words" "Another change"
// Sets the app version to today's date plus a running number for that day (2026-11-05.1, 2026-11-05.2, ...),
// and records the notes shown to people when they click the Update button.
// The first update on a new day starts again at 1.
import { readFileSync, writeFileSync } from "node:fs";

const notes = process.argv.slice(2).map((n) => n.trim()).filter(Boolean);
if (!notes.length) {
  console.error('Add at least one note about what changed, for example:\n  npm run bump -- "Fixed the print layout" "Added a Sheet button"');
  process.exit(1);
}

const versionFile = new URL("../version.json", import.meta.url);
const changelogFile = new URL("../changelog.json", import.meta.url);
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

let prev = { date: "", build: 0 };
try { prev = JSON.parse(readFileSync(versionFile, "utf8")); } catch { /* first run */ }
const next = { date: today, build: prev.date === today ? prev.build + 1 : 1 };
const label = `${next.date}.${next.build}`;

let log = [];
try { log = JSON.parse(readFileSync(changelogFile, "utf8")); } catch { /* first run */ }
log = log.filter((e) => e.version !== label);
log.push({ version: label, notes });

writeFileSync(versionFile, JSON.stringify(next) + "\n");
writeFileSync(changelogFile, JSON.stringify(log, null, 2) + "\n");
console.log(`OnCue version ${label}`);
