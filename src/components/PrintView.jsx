import React from "react";
import { catOf } from "../lib/theme.js";
import { clockLabel, formatDateShort, secondsToMMSS, secondsToRuntimeLabel, timeStrToMinutes } from "../lib/scheduleUtils.js";

// Print-only rundown. Uses fixed black-on-white colors so it prints the same from either theme.

const startLabel = (r) => clockLabel(Math.round(r.startSec / 60));

function crewNotes(row, positions) {
  return positions
    .map((p) => ({ p, notes: row.roleNotes?.[p.id] || [] }))
    .filter((x) => x.notes.length);
}

function Header({ project, day, schedule }) {
  const when = day.date ? formatDateShort(day.date) : project.date ? formatDateShort(project.date) : "";
  const stats = [
    ["Starts", clockLabel(timeStrToMinutes(day.startTime))],
    ["Runs", secondsToRuntimeLabel(schedule.totalSec)],
    ["Ends", clockLabel(Math.round(schedule.endSec / 60))],
    ...(day.targetEnd ? [["Target end", clockLabel(timeStrToMinutes(day.targetEnd))]] : []),
  ];
  return (
    <header className="mb-4 flex items-end justify-between gap-8 border-b-2 border-black pb-3">
      <div className="min-w-0">
        <h1 className="font-display text-[20pt] font-bold leading-none tracking-tight">{project.name || "Untitled show"}</h1>
        <p className="mt-1.5 text-[10pt] text-neutral-700">
          <span className="font-semibold text-black">{day.label}</span>
          {when && <> · {when}</>}
          {project.venue && <> · {project.venue}</>}
        </p>
      </div>
      <dl className="flex shrink-0 gap-6 text-right">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[7.5pt] font-semibold uppercase tracking-wider text-neutral-600">{k}</dt>
            <dd className="clock text-[13pt] leading-tight">{v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function Notes({ row, positions, showCrew }) {
  const crew = showCrew ? crewNotes(row, positions) : [];
  if (!row.notes && !crew.length) return null;
  return (
    <div className="text-[9pt] leading-snug text-neutral-800">
      {row.notes && <p className="whitespace-pre-line">{row.notes}</p>}
      {crew.map(({ p, notes }) => (
        <p key={p.id} className="mt-0.5">
          <span className="font-semibold">{p.label}:</span> {notes.map((n) => n.text).join(" / ")}
        </p>
      ))}
    </div>
  );
}

function Footer({ project, day }) {
  const stamp = new Date().toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex justify-between pt-3 text-[7.5pt] text-neutral-600">
      <span>{project.name} · {day.label}</span>
      <span>Printed {stamp} · OnCue</span>
    </div>
  );
}

// One table so the header and footer repeat on every printed page, and no cue splits across a page break.
export default function PrintView({ project, day, schedule, positions, expandedIds }) {
  return (
    <div className="print-sheet hidden bg-white text-black print:block">
      <style>{`@page { size: letter portrait; margin: 0.55in 0.6in 0.55in; }`}</style>
      <table className="w-full border-collapse">
        <thead className="table-header-group"><tr><th className="p-0 text-left font-normal"><Header project={project} day={day} schedule={schedule} /></th></tr></thead>
        <tfoot className="table-footer-group"><tr><td className="p-0"><Footer project={project} day={day} /></td></tr></tfoot>
        <tbody>
          <tr>
            <td className="p-0">
              <ol>
                {schedule.rows.map((r) => {
                  const cat = catOf(r.category);
                  return (
                    <li key={r.id} className="grid break-inside-avoid grid-cols-[1.05in_1fr] gap-x-4 border-b border-neutral-300 py-2">
                      <div>
                        <div className="clock text-[14pt] leading-none">{startLabel(r)}</div>
                        <div className="clock mt-1 text-[8.5pt] text-neutral-600">{secondsToMMSS(r.durationSec)}{r.locked && " · HARD"}</div>
                      </div>
                      <div className="border-l-[3px] pl-3" style={{ borderColor: cat.color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="text-[12pt] font-bold leading-tight">{r.name}</div>
                          {r.owner && <div className="shrink-0 text-[9.5pt] font-medium">{r.owner}</div>}
                        </div>
                        <div className="text-[7.5pt] uppercase tracking-wide text-neutral-600">{cat.label}</div>
                        <div className="mt-1"><Notes row={r} positions={positions} showCrew={expandedIds.has(r.id)} /></div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
