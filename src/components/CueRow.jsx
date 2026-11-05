import React, { useState, useEffect } from "react";
import { Lock, LockOpen, GripVertical, ChevronUp, ChevronDown, Copy, Trash2, MessageSquare } from "lucide-react";
import { CATEGORIES, catOf } from "../lib/theme.js";
import { clockLabel, secondsToMMSS, mmssToSeconds, minutesToTimeStr } from "../lib/scheduleUtils.js";
import { IconBtn, StatusText, TimeField } from "./ui.jsx";
import NotesPanel from "./NotesPanel.jsx";

function visibleNoteCount(cue, isAdmin, isGuest, myPositionId) {
  const general = cue.notes ? 1 : 0;
  if (isGuest) return general;
  if (isAdmin) return general + Object.values(cue.roleNotes || {}).reduce((n, arr) => n + (arr || []).length, 0);
  return general + (myPositionId ? (cue.roleNotes?.[myPositionId] || []).length : 0);
}

export default function CueRow({
  cue, index, total, overSec = 0, isAdmin, isGuest, myPositionId, myPosition, positions, authorName,
  onUpdate, onDelete, onDuplicate, onMove, dragHandlers, isDragOver, isDragging,
  expanded, onToggleExpand, liveStatus, progress, onAddNote, onDeleteNote,
}) {
  const [durText, setDurText] = useState(secondsToMMSS(cue.durationSec));
  useEffect(() => setDurText(secondsToMMSS(cue.durationSec)), [cue.durationSec]);

  const cat = catOf(cue.category);
  const noteCount = visibleNoteCount(cue, isAdmin, isGuest, myPositionId);
  const isLive = liveStatus === "live";
  const isPast = liveStatus === "past";

  const commitDuration = () => {
    const parsed = mmssToSeconds(durText);
    if (parsed == null) setDurText(secondsToMMSS(cue.durationSec));
    else onUpdate({ durationSec: parsed });
  };

  const toggleLock = () => {
    if (!cue.locked) {
      const def = minutesToTimeStr(Math.round(cue.startSec / 60));
      onUpdate({ locked: true, lockedTime: cue.lockedTime || def });
    } else onUpdate({ locked: false });
  };

  const stateClass = isLive
    ? "row-live bg-paper text-ink"
    : isDragOver ? "bg-focus/10" : "hover:bg-ink/[0.03]";

  return (
    <div
      draggable={isAdmin}
      onDragStart={isAdmin ? dragHandlers.onDragStart : undefined}
      onDragOver={isAdmin ? dragHandlers.onDragOver : undefined}
      onDrop={isAdmin ? dragHandlers.onDrop : undefined}
      onDragEnd={isAdmin ? dragHandlers.onDragEnd : undefined}
      data-cue-id={cue.id}
      aria-current={isLive ? "step" : undefined}
      className={`relative border-b border-rule px-4 py-2.5 sm:px-6 ${stateClass} ${isDragging ? "opacity-40" : ""} ${isPast ? "text-mute" : ""}`}
    >
      <div className="cue-row">
        {/* index / grip / live marker */}
        <div className="a-idx num flex items-center gap-0.5 text-xs text-faint">
          {isLive ? (
            <span className="font-semibold text-ink">Now</span>
          ) : (
            <>
              {isAdmin && <GripVertical size={14} className="cue-actions -ml-1 cursor-grab text-faint active:cursor-grabbing" aria-hidden="true" />}
              <span>{index + 1}</span>
            </>
          )}
        </div>

        {/* start */}
        <div className="a-start num">
          {cue.locked && isAdmin ? (
            <TimeField
              value={cue.lockedTime}
              onChange={(v) => v && onUpdate({ lockedTime: v })}
              label="Hard start time"
              className="field clock !text-[1.0625rem] !font-bold"
            />
          ) : (
            <div className="clock flex items-center gap-1 text-[1.0625rem] leading-6">
              {clockLabel(Math.round(cue.startSec / 60))}
              {cue.locked && <Lock size={11} className="text-mute" aria-label="Hard time" />}
            </div>
          )}
          {cue.locked && <div className="leading-4"><StatusText status={cue.status} driftSec={cue.driftSec} /></div>}
          {overSec > 0 && (
            <div className="text-xs font-semibold leading-4 text-signal" title="How far this cue ran past its planned length">
              +{secondsToMMSS(overSec)} over
            </div>
          )}
          {overSec < 0 && cue.actualEnd && (
            <div className="text-xs font-semibold leading-4 text-ok" title="How far under its planned length this cue finished">
              &minus;{secondsToMMSS(-overSec)} under
            </div>
          )}
        </div>

        <div className="a-end clock text-[1.0625rem] leading-6 text-mute">{clockLabel(Math.round(cue.endSec / 60))}</div>

        {/* name */}
        <div className="a-name min-w-0">
          {isAdmin ? (
            <input
              value={cue.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Cue name"
              aria-label="Cue name"
              className="field text-base font-medium"
            />
          ) : (
            <div className="text-base font-medium">{cue.name || "Untitled cue"}</div>
          )}
        </div>

        <div className="a-meta">
          <div className="a-dur num">
            {isAdmin ? (
              <input
                value={durText}
                onChange={(e) => setDurText(e.target.value)}
                onBlur={commitDuration}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                placeholder="m:ss"
                aria-label="Duration, minutes and seconds"
                className="field clock !w-[4.25rem] !text-[1.0625rem]"
              />
            ) : (
              <span className="clock text-[1.0625rem]">{secondsToMMSS(cue.durationSec)}</span>
            )}
          </div>

          <div className="a-cat flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: cat.color }} aria-hidden="true" />
            {isAdmin ? (
              <select
                value={cue.category}
                onChange={(e) => onUpdate({ category: e.target.value })}
                aria-label="Category"
                className="field !m-0 !w-auto min-w-0 cursor-pointer text-sm"
              >
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            ) : (
              <span className="truncate text-sm">{cat.label}</span>
            )}
          </div>

          <div className="a-owner min-w-0 text-sm">
            {isAdmin ? (
              <input
                value={cue.owner}
                onChange={(e) => onUpdate({ owner: e.target.value })}
                placeholder="Presenter"
                aria-label="Presenter"
                className="field"
              />
            ) : (
              <span className="block truncate">{cue.owner || <span className="text-faint">No presenter</span>}</span>
            )}
          </div>

          <div className="a-notes">
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              className="inline-flex h-7 items-center gap-1.5 rounded-btn px-1.5 text-sm text-mute transition-colors hover:bg-ink/10 hover:text-ink"
            >
              <MessageSquare size={14} className={noteCount ? "text-ink" : ""} />
              {noteCount > 0 ? <span className="num font-medium text-ink">{noteCount}</span> : <span>{expanded ? "Close" : "Add"}</span>}
            </button>
          </div>

          {isAdmin && (
            <div className="a-act cue-actions no-print flex items-center justify-end">
              <IconBtn onClick={toggleLock} title={cue.locked ? "Release hard time" : "Set a hard time"}>
                {cue.locked ? <Lock size={15} className="text-ink" /> : <LockOpen size={15} />}
              </IconBtn>
              <IconBtn onClick={() => onMove(-1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></IconBtn>
              <IconBtn onClick={() => onMove(1)} disabled={index === total - 1} title="Move down"><ChevronDown size={15} /></IconBtn>
              <IconBtn onClick={onDuplicate} title="Duplicate cue"><Copy size={14} /></IconBtn>
              <IconBtn onClick={onDelete} title="Delete cue" danger><Trash2 size={14} /></IconBtn>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <NotesPanel
          cue={cue} isAdmin={isAdmin} isGuest={isGuest} myPosition={myPosition} positions={positions}
          authorName={authorName} onUpdate={onUpdate} onAddNote={onAddNote} onDeleteNote={onDeleteNote}
        />
      )}

      {isLive && progress != null && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/20" aria-hidden="true">
          <div className="h-full bg-signal" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
