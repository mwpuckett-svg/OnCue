import React, { useState, useEffect } from "react";
import { Lock, Unlock, GripVertical, ChevronUp, ChevronDown, Copy, Trash2, StickyNote } from "lucide-react";
import { theme } from "../lib/theme.js";
import { CATEGORIES, catOf } from "../lib/theme.js";
import { clockLabel, secondsToMMSS, mmssToSeconds, minutesToTimeStr } from "../lib/scheduleUtils.js";
import { IconBtn, StatusBadge } from "./ui.jsx";
import NotesPanel from "./NotesPanel.jsx";

function hasRelevantNotes(cue, isAdmin, isGuest, myPositionId) {
  if (isAdmin) return !!cue.notes || Object.values(cue.roleNotes || {}).some((arr) => (arr || []).length > 0);
  if (isGuest) return !!cue.notes;
  return !!(cue.roleNotes && myPositionId && (cue.roleNotes[myPositionId] || []).length > 0);
}

export default function CueRow({
  cue, index, total, isAdmin, isGuest, myPositionId, myPosition, positions, authorName,
  onUpdate, onDelete, onDuplicate, onMove, dragHandlers, isDragOver, isDragging,
  expanded, onToggleExpand, liveStatus, onAddNote, onDeleteNote,
}) {
  const [durText, setDurText] = useState(secondsToMMSS(cue.durationSec));
  useEffect(() => setDurText(secondsToMMSS(cue.durationSec)), [cue.durationSec]);
  const cat = catOf(cue.category);
  const noteFlag = hasRelevantNotes(cue, isAdmin, isGuest, myPositionId);
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

  return (
    <div
      draggable={isAdmin}
      onDragStart={isAdmin ? dragHandlers.onDragStart : undefined}
      onDragOver={isAdmin ? dragHandlers.onDragOver : undefined}
      onDrop={isAdmin ? dragHandlers.onDrop : undefined}
      onDragEnd={isAdmin ? dragHandlers.onDragEnd : undefined}
      className="relative rounded-xl p-3 transition-colors"
      style={{
        background: isDragOver ? theme.panelAlt : theme.panel,
        border: `1px solid ${isLive ? theme.green : isDragOver ? theme.hairlineLight : theme.hairline}`,
        boxShadow: isLive ? `0 0 0 1px ${theme.green}55, 0 0 18px ${theme.green}2E` : "none",
        opacity: isDragging ? 0.4 : isPast ? 0.5 : 1,
      }}
    >
      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: cat.color }} />

      <div className="flex flex-wrap items-center gap-2 pl-3">
        {isAdmin && (
          <div className="hidden sm:flex cursor-grab active:cursor-grabbing shrink-0" style={{ color: theme.textFaint }}>
            <GripVertical size={16} />
          </div>
        )}
        {isAdmin && (
          <div className="flex flex-col shrink-0 -my-1">
            <IconBtn onClick={() => onMove(-1)} disabled={index === 0} title="Move up" style={{ color: theme.textMuted }}><ChevronUp size={13} /></IconBtn>
            <IconBtn onClick={() => onMove(1)} disabled={index === total - 1} title="Move down" style={{ color: theme.textMuted }}><ChevronDown size={13} /></IconBtn>
          </div>
        )}

        {isLive ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1 ros-mono" style={{ background: theme.green, color: "#04150D" }}>
            <span className="w-1.5 h-1.5 rounded-full ros-pulse" style={{ background: "#04150D" }} /> LIVE
          </span>
        ) : (
          <div className="text-xs w-5 text-right shrink-0 ros-mono" style={{ color: theme.textFaint }}>{index + 1}</div>
        )}

        {isAdmin ? (
          <select
            value={cue.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            className="text-[11px] font-semibold rounded-md px-1.5 py-1 outline-none shrink-0 max-w-[110px]"
            style={{ background: "transparent", color: cat.color, border: `1px solid ${cat.color}55` }}
          >
            {CATEGORIES.map((c) => <option key={c.key} value={c.key} style={{ color: "#111" }}>{c.label}</option>)}
          </select>
        ) : (
          <span className="text-[11px] font-semibold rounded-md px-1.5 py-1 shrink-0" style={{ color: cat.color, border: `1px solid ${cat.color}55` }}>{cat.label}</span>
        )}

        {isAdmin ? (
          <input
            value={cue.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Cue name"
            className="flex-1 min-w-[140px] bg-transparent outline-none font-medium text-[14px] border-b border-transparent focus:border-white/20 py-0.5"
            style={{ color: theme.text }}
          />
        ) : (
          <span className="flex-1 min-w-[140px] font-medium text-[14px] py-0.5" style={{ color: theme.text }}>{cue.name}</span>
        )}

        {isAdmin ? (
          <input
            value={durText}
            onChange={(e) => setDurText(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="mm:ss"
            title="Duration (mm:ss)"
            className="ros-mono text-center w-16 rounded-md px-1 py-1 text-[13px] outline-none shrink-0"
            style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}
          />
        ) : (
          <span className="ros-mono text-center w-16 text-[13px] shrink-0" style={{ color: theme.textMuted }}>{secondsToMMSS(cue.durationSec)}</span>
        )}

        <span className="text-xs shrink-0" style={{ color: theme.textFaint }}>→</span>

        {cue.locked && isAdmin ? (
          <input
            type="time"
            value={cue.lockedTime}
            onChange={(e) => onUpdate({ lockedTime: e.target.value })}
            className="ros-mono w-[92px] rounded-md px-1 py-1 text-[13px] outline-none shrink-0"
            style={{ background: theme.panelAlt, color: theme.amber, border: `1px solid ${theme.amber}66` }}
          />
        ) : (
          <span className="ros-mono w-[92px] text-[13px] shrink-0" style={{ color: theme.amber }}>{clockLabel(Math.round(cue.startSec / 60))}</span>
        )}

        <span className="ros-mono w-[92px] text-[13px] shrink-0" style={{ color: theme.textMuted }}>{clockLabel(Math.round(cue.endSec / 60))}</span>

        {isAdmin && (
          <>
            <IconBtn onClick={toggleLock} title={cue.locked ? "Hard time — click to unlock" : "Flows with schedule — click to lock a hard time"} style={{ color: cue.locked ? theme.amber : theme.textMuted }}>
              {cue.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </IconBtn>
            <IconBtn onClick={onDuplicate} title="Duplicate cue" style={{ color: theme.textMuted }}><Copy size={14} /></IconBtn>
            <IconBtn onClick={onDelete} title="Delete cue" style={{ color: theme.textMuted }} danger><Trash2 size={14} /></IconBtn>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 sm:pl-[104px] mt-1.5">
        {isAdmin ? (
          <input
            value={cue.owner}
            onChange={(e) => onUpdate({ owner: e.target.value })}
            placeholder="Owner / presenter"
            className="bg-transparent outline-none text-xs w-36"
            style={{ color: theme.textMuted }}
          />
        ) : cue.owner ? (
          <span className="text-xs" style={{ color: theme.textMuted }}>{cue.owner}</span>
        ) : null}

        <button type="button" onClick={onToggleExpand} className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: noteFlag ? theme.amber : theme.textFaint }}>
          <StickyNote size={12} /> Notes
          {noteFlag && <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.amber }} />}
        </button>

        {cue.locked && <StatusBadge status={cue.status} driftSec={cue.driftSec} />}
      </div>

      {expanded && (
        <NotesPanel
          cue={cue} isAdmin={isAdmin} isGuest={isGuest} myPosition={myPosition} positions={positions}
          authorName={authorName} onUpdate={onUpdate} onAddNote={onAddNote} onDeleteNote={onDeleteNote}
        />
      )}
    </div>
  );
}
