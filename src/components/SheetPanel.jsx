import React, { useState, useMemo } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button, Drawer, SectionLabel } from "./ui.jsx";
import { clockLabel, timeStrToMinutes, secondsToMMSS } from "../lib/scheduleUtils.js";
import { extractSheetRef, sheetUrl, readSheet, resolveColumns } from "../lib/sheetSync.js";
import { fetchSheetCsv } from "../lib/sheetClient.js";
import { ask } from "../lib/confirm.js";

const timeAgo = (ms) => {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function SheetPanel({ day, positions, state = {}, onLink, onUnlink, onSync, onClose }) {
  const linked = !!day.sheetId;
  const [editing, setEditing] = useState(!linked);
  const [url, setUrl] = useState(linked ? sheetUrl(day.sheetId, day.sheetGid) : "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [csv, setCsv] = useState(null);
  const [ref, setRef] = useState(null);
  const [format, setFormat] = useState("auto");
  const [choices, setChoices] = useState({});
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const parsed = useMemo(() => (csv == null ? null : readSheet(csv, { lengthFormat: format })), [csv, format]);
  const columns = useMemo(() => {
    if (!parsed || !parsed.ok) return [];
    const saved = {};
    Object.entries(choices).forEach(([h, v]) => { if (v === "skip" || (v && v !== "new")) saved[h] = v; });
    const base = resolveColumns(parsed.deptHeaders, positions, linked ? { ...day.sheetMap, ...saved } : saved);
    return base.map((c) => (choices[c.header] === "new" ? { ...c, action: "new", positionId: null } : c));
  }, [parsed, positions, choices, linked, day.sheetMap]);

  const existingCount = day.cues.length;
  const syncError = state.error !== undefined ? state.error : day.sheetError;

  const check = async () => {
    const r = extractSheetRef(url.trim());
    if (!r) { setError("Paste the link to your Google Sheet. It looks like docs.google.com/spreadsheets/d/…"); return; }
    setError(""); setResult(""); setChecking(true);
    try {
      const text = await fetchSheetCsv(r.id, r.gid);
      setRef(r); setCsv(text); setChoices({}); setFormat("auto");
      setReplace(existingCount > 0 && !linked);
    } catch (e) {
      setCsv(null); setError(e.message);
    } finally { setChecking(false); }
  };

  const link = async () => {
    if (!parsed || !parsed.ok) return;
    if (replace && existingCount) {
      const ok = await ask({ title: `Replace the ${existingCount} cues on ${day.label}?`, body: "They're removed and the sheet's cues take their place. Cues already run on the live show are kept.", confirmLabel: "Replace and import", danger: true });
      if (!ok) return;
    }
    const map = {};
    columns.forEach((c) => { if (c.action === "skip") map[c.header] = "skip"; else if (c.action === "existing") map[c.header] = c.positionId; });
    setBusy(true);
    const r = await onLink({ sheetId: ref.id, sheetGid: ref.gid, lengthFormat: parsed.lengthFormat, map, replaceExisting: replace });
    setBusy(false);
    if (r?.status === "synced") {
      setResult(`Imported ${r.summary.total} ${r.summary.total === 1 ? "cue" : "cues"}.`);
      setEditing(false); setCsv(null);
    } else if (r?.status === "error") setError(r.message || "");
  };

  const syncNow = async () => {
    setResult("");
    const r = await onSync({ force: true });
    if (r?.status === "synced") {
      const s = r.summary;
      setResult(s.added || s.changed || s.removed ? `Synced: ${s.added} added, ${s.changed} changed, ${s.removed} removed.` : "Already up to date.");
    }
  };

  const unlink = async () => {
    const ok = await ask({ title: "Unlink this sheet?", body: `${day.label} keeps all its cues and crew notes. They just stop following the sheet.`, confirmLabel: "Unlink", danger: true });
    if (!ok) return;
    await onUnlink();
    setEditing(true); setCsv(null); setUrl(""); setResult("");
  };

  const sampleCue = parsed?.ok ? parsed.cues.find((c) => c.durationSec) : null;
  const sampleRaw = parsed?.ok && sampleCue ? sampleCue : null;

  return (
    <Drawer
      title="Google Sheet"
      subtitle={`${day.label} pulls its cues from a Google Sheet and refreshes on its own about every 30 seconds.`}
      onClose={onClose}
    >
      {linked && !editing && (
        <div>
          <SectionLabel>Linked sheet</SectionLabel>
          <a href={sheetUrl(day.sheetId, day.sheetGid)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
            Open in Google Sheets <ExternalLink size={13} />
          </a>
          <div className="mt-3 text-sm" aria-live="polite">
            {state.checking ? <span className="text-mute">Checking the sheet…</span>
              : syncError ? <span className="text-signal">{syncError}</span>
              : <span className="text-mute">Synced {day.sheetSyncedAt ? timeAgo(day.sheetSyncedAt) : "just now"}{state.checkedAt ? ` · checked ${timeAgo(state.checkedAt)}` : ""}</span>}
          </div>
          {result && <p className="mt-1 text-sm">{result}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={syncNow} disabled={state.checking}><RefreshCw size={14} /> Sync now</Button>
            <Button variant="outline" onClick={() => { setEditing(true); setResult(""); }}>Change sheet or columns</Button>
            <Button variant="danger" onClick={unlink}>Unlink</Button>
          </div>
          <div className="mt-6 border-t border-rule pt-4 text-sm text-mute">
            <p><strong className="font-semibold text-ink">What comes from the sheet:</strong> each cue's name, length, presenter and notes, plus crew notes from the extra columns (Audio, Video and so on). The first TIME sets when the day starts.</p>
            <p className="mt-2">A change you make to one of those in OnCue stays until that same cell changes in the sheet. Cues you add in OnCue stay below the sheet's cues, and cues already run on the live show are never removed.</p>
          </div>
        </div>
      )}

      {editing && (
        <div>
          <label htmlFor="sheet-url" className="mb-1 block text-sm font-medium">Google Sheet link</label>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(); }}>
            <input
              id="sheet-url" value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="https://docs.google.com/spreadsheets/d/…" className="field-boxed" autoFocus={!linked}
              aria-invalid={!!error} aria-describedby={error ? "sheet-error" : undefined}
            />
            <Button variant="primary" type="submit" disabled={checking || !url.trim()} className="shrink-0">{checking ? "Checking" : "Check sheet"}</Button>
          </form>
          <p className="mt-1.5 text-xs text-mute">The sheet needs General access set to Anyone with the link (Viewer). To use a different tab, open that tab first and copy the link.</p>
          {error && <p id="sheet-error" role="alert" className="mt-2 text-sm text-signal">{error}</p>}

          {parsed && !parsed.ok && <p role="alert" className="mt-3 text-sm text-signal">{parsed.error}</p>}

          {parsed?.ok && (
            <div className="mt-5">
              <SectionLabel>What we found</SectionLabel>
              <p className="mt-1 text-sm">
                <strong className="font-semibold">{parsed.cues.length} {parsed.cues.length === 1 ? "cue" : "cues"}</strong>
                {parsed.startTime ? `, starting ${clockLabel(timeStrToMinutes(parsed.startTime))}` : ""}. Headers are on row {parsed.headerRow}.
                {parsed.skipped > 0 && <span className="text-mute"> {parsed.skipped} empty {parsed.skipped === 1 ? "row was" : "rows were"} skipped.</span>}
              </p>

              {parsed.cues.length > 0 && (
                <ul className="mt-2 divide-y divide-rule border-y border-rule text-sm">
                  {parsed.cues.slice(0, 4).map((c) => (
                    <li key={c.key} className="flex items-baseline gap-3 py-1.5">
                      <span className="clock num w-12 shrink-0 text-mute">{secondsToMMSS(c.durationSec)}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      {c.owner && <span className="shrink-0 truncate text-mute">{c.owner}</span>}
                    </li>
                  ))}
                  {parsed.cues.length > 4 && <li className="py-1.5 text-mute">and {parsed.cues.length - 4} more</li>}
                </ul>
              )}

              <fieldset className="mt-4">
                <legend className="text-sm font-medium">What does a length like “0:20” mean?</legend>
                <div className="mt-1 flex flex-col gap-1 text-sm">
                  {[["hm", "Hours and minutes: 0:20 is 20 minutes"], ["ms", "Minutes and seconds: 0:20 is 20 seconds"]].map(([v, label]) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="len" checked={parsed.lengthFormat === v} onChange={() => setFormat(v)} className="accent-[rgb(var(--ink))]" />
                      {label}{parsed.detectedFormat === v && <span className="text-xs text-mute">(matches the TIME column)</span>}
                    </label>
                  ))}
                </div>
                {sampleRaw && <p className="mt-1 text-xs text-mute">With this choice “{sampleRaw.name}” runs {secondsToMMSS(sampleRaw.durationSec)}.</p>}
              </fieldset>

              {columns.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium">Crew columns</div>
                  <p className="text-xs text-mute">Each column's text becomes a note for that crew position on the cue.</p>
                  <ul className="mt-2 divide-y divide-rule border-y border-rule">
                    {columns.map((c) => (
                      <li key={c.header} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="w-24 shrink-0 truncate font-medium" title={c.header}>{c.header}</span>
                        <span aria-hidden="true" className="text-mute">→</span>
                        <select
                          aria-label={`Position for ${c.header}`} className="field-boxed !py-1 flex-1"
                          value={c.action === "skip" ? "skip" : c.action === "new" ? "new" : c.positionId}
                          onChange={(e) => setChoices((prev) => ({ ...prev, [c.header]: e.target.value }))}
                        >
                          {positions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          <option value="new">New position: {c.action === "new" ? c.label : c.header}</option>
                          <option value="skip">Don't import</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-3 text-xs text-mute">
                {parsed.hasPresenterColumn ? "Presenter comes from the Presenter column." : "Presenter comes from the lines under the title in the program cell."}
              </p>
              {parsed.warnings.slice(0, 3).map((w) => <p key={w} className="mt-1 text-xs text-signal">{w}</p>)}

              {existingCount > 0 && (
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--ink))]" />
                  <span>Replace the {existingCount} {existingCount === 1 ? "cue" : "cues"} already on {day.label}<span className="block text-xs text-mute">Leave this off to keep them below the sheet's cues.</span></span>
                </label>
              )}

              <div className="mt-5 flex gap-2">
                <Button variant="primary" onClick={link} disabled={busy || parsed.cues.length === 0}>{busy ? "Importing" : linked ? "Save and sync" : "Link and import"}</Button>
                {linked && <Button variant="quiet" onClick={() => { setEditing(false); setCsv(null); }}>Cancel</Button>}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
