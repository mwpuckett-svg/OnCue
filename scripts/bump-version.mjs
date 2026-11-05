// Run before shipping any update: `npm run bump`.
// Sets the app version to today's date plus a running number for that day, e.g. 2026-11-05.1, 2026-11-05.2.
// The first update on a new day starts again at 1.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../version.json", import.meta.url);
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

let prev = { date: "", build: 0 };
try { prev = JSON.parse(readFileSync(file, "utf8")); } catch { /* first run */ }

const next = { date: today, build: prev.date === today ? prev.build + 1 : 1 };
writeFileSync(file, JSON.stringify(next) + "\n");
console.log(`OnCue version ${next.date}.${next.build}`);
