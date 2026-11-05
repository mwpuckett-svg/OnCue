import React from "react";
import { clockLabel, secondsToMMSS } from "../lib/scheduleUtils.js";
import { Button } from "./ui.jsx";

/**
 * The calling strip. Everyone sees what is on now and what is next.
 * Admins (stage manager, producer, production manager) also get GO.
 */
export default function GoBar({ rows, liveIdx, liveStartedAt, nowMs, isAdmin, onGo, onBack, onEnd }) {
  const started = liveIdx >= 0;
  if (!started && !isAdmin) return null;
  if (rows.length === 0) return null;

  const live = started ? rows[liveIdx] : null;
  const next = started ? rows[liveIdx + 1] : rows[0];
  const elapsed = started ? Math.max(0, Math.floor((nowMs - liveStartedAt) / 1000)) : 0;
  const remaining = started ? live.durationSec - elapsed : 0;
  const over = started && remaining < 0;
  const isLast = started && liveIdx === rows.length - 1;

  const goLabel = !started ? "Start show" : isLast ? "End show" : "GO";

  return (
    <section aria-label="Show calling" className="no-print border-b border-rule-strong px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-10 gap-y-2">
          <div className="min-w-[12rem]">
            <div className="text-xs text-mute">On now</div>
            {started ? (
              <>
                <div className="truncate font-display text-[1.75rem] font-semibold leading-8">{live.name || "Untitled cue"}</div>
                <div className={`clock num text-lg leading-6 ${over ? "text-signal" : "text-mute"}`} aria-live="off">
                  {over ? `${secondsToMMSS(-remaining)} over` : `${secondsToMMSS(remaining)} left`}
                  {!over && <span className="font-body text-sm font-normal text-mute"> of {secondsToMMSS(live.durationSec)}</span>}
                </div>
              </>
            ) : (
              <div className="font-display text-[1.75rem] font-semibold leading-8 text-mute">Not started</div>
            )}
          </div>
          <div className="min-w-[12rem]">
            <div className="text-xs text-mute">{started ? "Next" : "First cue"}</div>
            {next ? (
              <>
                <div className="truncate font-display text-[1.75rem] font-semibold leading-8">{next.name || "Untitled cue"}</div>
                <div className="text-sm text-mute">
                  {next.locked ? `Hard time ${clockLabel(Math.round(next.startSec / 60))}` : `Starts about ${clockLabel(Math.round(next.startSec / 60))}`}
                </div>
              </>
            ) : (
              <div className="font-display text-[1.75rem] font-semibold leading-8 text-mute">End of show</div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {started && <Button variant="outline" size="lg" onClick={onBack} title="Go back one cue (restarts that cue's clock)">Back</Button>}
            <button
              type="button"
              onClick={onGo}
              aria-label={started && !isLast ? "GO, next cue" : goLabel}
              title={started ? "Advance to the next cue (Space)" : "Start the show at the first cue"}
              className="flex h-14 flex-1 items-center justify-center gap-3 rounded-[12px] bg-ok px-8 text-paper transition-colors hover:bg-ok/85 sm:min-w-[10rem] sm:flex-none"
            >
              <span className={`clock leading-none ${started && !isLast ? "text-[2rem]" : "text-[1.375rem]"}`}>{goLabel}</span>
              {started && !isLast && <kbd className="hidden rounded-[2px] border border-paper/40 sm:inline px-1.5 text-[11px] font-medium text-paper/80">Space</kbd>}
            </button>
            {started && !isLast && <Button variant="quiet" size="lg" onClick={onEnd}>End show</Button>}
          </div>
        )}
      </div>
    </section>
  );
}
