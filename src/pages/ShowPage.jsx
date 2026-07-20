import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Download, RotateCcw, Layers, ChevronDown, UserPlus, Settings2, Copy, Trash2 } from "lucide-react";
import { theme, CATEGORIES, catOf } from "../lib/theme.js";
import {
  clockLabel, timeStrToMinutes, secondsToMMSS, secondsToRuntimeLabel,
  computeSchedule, todayLocalStr, formatNoteTime,
} from "../lib/scheduleUtils.js";
import { IconBtn, LoadingBlock, InsertDivider } from "../components/ui.jsx";
import DayTabs from "../components/DayTabs.jsx";
import CueRow from "../components/CueRow.jsx";
import InvitePanel from "../components/InvitePanel.jsx";
import PositionsPanel from "../components/PositionsPanel.jsx";
import JoinGate from "../components/JoinGate.jsx";

export default function ShowPage({ data, user, onGoToProjects }) {
  const {
    project, positions, days, invites, members, myMembership, loading, editingRef,
    updateShow, addPosition, renamePosition, recolorPosition, toggleAdminPosition, deletePosition,
    addDay, updateDay, deleteDay, duplicateDay,
    addCue, updateCue, deleteCue, duplicateCue, reorderCues,
    addNote, deleteNote, addInvite, removeInvite, joinProject, updateMyMembership,
  } = data;

  const [activeDayId, setActiveDayId] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showPositionsPanel, setShowPositionsPanel] = useState(false);
  const [showSwitchGate, setShowSwitchGate] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    if (!activeDayId && days.length) setActiveDayId(days[0].id);
    else if (activeDayId && days.length && !days.some((d) => d.id === activeDayId)) setActiveDayId(days[0].id);
  }, [days, activeDayId]);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const isAdmin = !!(myMembership && !myMembership.is_guest && positions.find((p) => p.id === myMembership.position_id)?.is_admin);
  const isGuest = !!(myMembership && myMembership.is_guest);
  const myPosition = myMembership && !myMembership.is_guest ? positions.find((p) => p.id === myMembership.position_id) : null;

  const FALLBACK_DAY = { startTime: "18:00", targetEnd: "", cues: [] };
  const activeDay = days.find((d) => d.id === activeDayId) || days[0] || FALLBACK_DAY;
  const schedule = useMemo(() => computeSchedule(activeDay, activeDay.cues), [activeDay]);

  const isLiveDay = !activeDay.date || activeDay.date === todayLocalStr();
  const nowSecRaw = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const nowExtended = isLiveDay ? (nowSecRaw < schedule.startSec ? nowSecRaw + 86400 : nowSecRaw) : null;

  if (loading || !project) return <LoadingBlock text="Loading show…" />;

  const toggleExpand = (id) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allExpanded = schedule.rows.length > 0 && schedule.rows.every((r) => expandedIds.has(r.id));
  const toggleExpandAll = () => setExpandedIds(allExpanded ? new Set() : new Set(schedule.rows.map((r) => r.id)));

  const onDrop = (index) => {
    const from = dragIndexRef.current;
    if (from != null && from !== index) {
      const ids = activeDay.cues.map((c) => c.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(index, 0, moved);
      reorderCues(activeDay.id, ids);
    }
    dragIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const exportCSV = () => {
    const fmtNotes = (arr) => (arr || []).map((n) => `${n.author || "Unattributed"}${n.ts ? ` @ ${formatNoteTime(n.ts)}` : ""}: ${n.text}`).join(" | ");
    const header = ["#", "Category", "Item", "Duration", "Start", "End", "Owner", "General Notes", ...positions.map((p) => p.label + " Notes"), "Locked"];
    const lines = [header.join(",")];
    schedule.rows.forEach((r, i) => {
      const vals = [
        i + 1, catOf(r.category).label, r.name, secondsToMMSS(r.durationSec),
        clockLabel(Math.round(r.startSec / 60)), clockLabel(Math.round(r.endSec / 60)),
        r.owner || "", r.notes || "", ...positions.map((p) => fmtNotes(r.roleNotes[p.id])), r.locked ? "Y" : "N",
      ];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project.name || "run-of-show").replace(/[^a-z0-9]+/gi, "-")}-${(activeDay.label || "day").replace(/[^a-z0-9]+/gi, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetAll = async () => {
    if (!window.confirm(`Reset "${project.name}"? This clears every day, position, invite, and cue in this show and cannot be undone. Other shows aren't affected.`)) return;
    for (const d of days.slice(1)) await deleteDay(d.id);
    // leave the first day but strip its cues
    const first = days[0];
    if (first) for (const c of first.cues) await deleteCue(c.id);
    for (const inv of invites) await removeInvite(inv.id);
  };

  const variance = schedule.variance;
  const varianceLabel = variance == null ? null : `${variance > 60 ? "+" : variance < -60 ? "−" : ""}${secondsToRuntimeLabel(Math.abs(variance))} ${variance > 60 ? "over" : variance < -60 ? "under" : "on target"}`;
  const varianceColor = variance == null ? theme.textMuted : variance > 60 ? theme.red : variance < -60 ? theme.green : theme.gold;

  const needsJoin = !myMembership;

  return (
    <div>
      {(needsJoin || showSwitchGate) && (
        <JoinGate
          mode={needsJoin ? "pick" : "switch"}
          positions={positions}
          invites={invites}
          userEmail={user.email}
          currentPositionId={myMembership?.position_id}
          currentIsGuest={myMembership?.is_guest}
          currentName={myMembership?.display_name}
          onJoin={async (positionId, guest, displayName) => {
            if (needsJoin) await joinProject(positionId, guest, displayName);
            else await updateMyMembership({ positionId, isGuest: guest, displayName });
            setShowSwitchGate(false);
          }}
          onClose={() => setShowSwitchGate(false)}
        />
      )}
      {showInvitePanel && isAdmin && (
        <InvitePanel invites={invites} positions={positions} onAdd={addInvite} onRemove={removeInvite} onClose={() => setShowInvitePanel(false)} />
      )}
      {showPositionsPanel && isAdmin && (
        <PositionsPanel positions={positions} onAdd={addPosition} onRename={renamePosition} onRecolor={recolorPosition} onToggleAdmin={toggleAdminPosition} onDelete={deletePosition} onClose={() => setShowPositionsPanel(false)} />
      )}

      {!needsJoin && (
        <div
          className="max-w-5xl mx-auto px-4 py-6 sm:py-10"
          onFocusCapture={(e) => { if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) editingRef.current = true; }}
          onBlurCapture={(e) => { if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) editingRef.current = false; }}
        >
          {/* HEADER */}
          <div className="rounded-2xl p-5 sm:p-7 mb-5" style={{ background: theme.panel, border: `1px solid ${theme.hairline}` }}>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div className="min-w-[200px] flex-1">
                {isAdmin ? (
                  <input
                    value={project.name}
                    onChange={(e) => updateShow({ name: e.target.value })}
                    className="font-display bg-transparent outline-none font-semibold text-2xl sm:text-3xl w-full"
                    style={{ color: theme.text }}
                    placeholder="Untitled Event"
                  />
                ) : (
                  <h1 className="font-display font-semibold text-2xl sm:text-3xl" style={{ color: theme.text }}>{project.name}</h1>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {isAdmin ? (
                    <input value={project.venue} onChange={(e) => updateShow({ venue: e.target.value })} placeholder="Venue" className="bg-transparent outline-none text-sm" style={{ color: theme.textMuted }} />
                  ) : project.venue ? <span className="text-sm" style={{ color: theme.textMuted }}>{project.venue}</span> : null}
                  {isAdmin ? (
                    <input type="date" value={project.date || ""} onChange={(e) => updateShow({ date: e.target.value })} className="bg-transparent outline-none text-sm" style={{ color: theme.textMuted }} />
                  ) : project.date ? <span className="text-sm" style={{ color: theme.textMuted }}>{project.date}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onGoToProjects} className="ros-surface-btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" style={{ border: `1px solid ${theme.hairline}`, color: theme.textMuted }}>
                  <Layers size={12} /> All shows
                </button>
                <button onClick={() => setShowSwitchGate(true)} className="ros-surface-btn inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" style={{ border: `1px solid ${theme.hairline}`, color: theme.textMuted }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: isGuest ? theme.textMuted : myPosition?.color || theme.textMuted }} />
                  {isGuest ? "Guest / Client" : myPosition?.label || "Unknown"}
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            <DayTabs days={days} activeDayId={activeDay.id} onSelect={setActiveDayId} isAdmin={isAdmin} onAdd={addDay} />

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 mt-2 mb-5 p-2.5 rounded-lg" style={{ background: theme.panelAlt, border: `1px solid ${theme.hairline}` }}>
                <input value={activeDay.label} onChange={(e) => updateDay(activeDay.id, { label: e.target.value })} className="text-sm font-semibold bg-transparent outline-none" style={{ color: theme.text, minWidth: 90 }} placeholder="Day label" />
                <input type="date" value={activeDay.date} onChange={(e) => updateDay(activeDay.id, { date: e.target.value })} className="text-xs bg-transparent outline-none" style={{ color: theme.textMuted }} />
                <div className="flex-1" />
                <IconBtn onClick={() => duplicateDay(activeDay.id)} title="Duplicate day" style={{ color: theme.textMuted }}><Copy size={14} /></IconBtn>
                <IconBtn onClick={() => deleteDay(activeDay.id)} title="Delete day" style={{ color: theme.textMuted }} danger disabled={days.length <= 1}><Trash2 size={14} /></IconBtn>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-5">
              <div>
                <div className="text-[11px] font-semibold tracking-widest uppercase mb-1 flex items-center gap-1.5" style={{ color: theme.textFaint }}>
                  {isLiveDay && <span className="w-1.5 h-1.5 rounded-full ros-pulse" style={{ background: theme.green }} />} Now
                </div>
                <div className="ros-mono font-semibold text-3xl sm:text-4xl" style={{ color: isLiveDay ? theme.green : theme.textFaint }}>{isLiveDay ? clockLabel(Math.floor(nowSecRaw / 60)) : "—"}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: theme.textFaint }}>Start</div>
                {isAdmin ? (
                  <input type="time" value={activeDay.startTime} onChange={(e) => updateDay(activeDay.id, { startTime: e.target.value })} className="ros-mono bg-transparent outline-none font-semibold text-3xl sm:text-4xl" style={{ color: theme.amber }} />
                ) : (
                  <div className="ros-mono font-semibold text-3xl sm:text-4xl" style={{ color: theme.amber }}>{clockLabel(timeStrToMinutes(activeDay.startTime))}</div>
                )}
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: theme.textFaint }}>Runtime</div>
                <div className="ros-mono font-semibold text-3xl sm:text-4xl" style={{ color: theme.text }}>{secondsToRuntimeLabel(schedule.totalSec)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: theme.textFaint }}>End</div>
                <div className="ros-mono font-semibold text-3xl sm:text-4xl" style={{ color: theme.amber }}>{clockLabel(Math.round(schedule.endSec / 60))}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: theme.textFaint }}>Target end</div>
                {isAdmin ? (
                  <input type="time" value={activeDay.targetEnd} onChange={(e) => updateDay(activeDay.id, { targetEnd: e.target.value })} className="ros-mono bg-transparent outline-none text-lg" style={{ color: theme.textMuted }} />
                ) : (
                  <div className="ros-mono text-lg" style={{ color: theme.textMuted }}>{activeDay.targetEnd ? clockLabel(timeStrToMinutes(activeDay.targetEnd)) : "—"}</div>
                )}
                {varianceLabel && <div className="text-xs font-semibold mt-1" style={{ color: varianceColor }}>{varianceLabel}</div>}
              </div>
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <button onClick={() => addCue(activeDay.id, schedule.rows.length)} className="ros-primary-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity" style={{ background: theme.amber, color: "#1A1204" }}>
                  <Plus size={15} /> Add cue
                </button>
              )}
              <button onClick={() => setShowLegend((v) => !v)} className="ros-surface-btn text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textMuted, border: `1px solid ${theme.hairline}` }}>
                {showLegend ? "Hide" : "Show"} categories
              </button>
              {isAdmin && schedule.rows.length > 0 && (
                <button onClick={toggleExpandAll} className="ros-surface-btn text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textMuted, border: `1px solid ${theme.hairline}` }}>
                  {allExpanded ? "Collapse all notes" : "Expand all notes"}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowPositionsPanel(true)} className="ros-surface-btn inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textMuted, border: `1px solid ${theme.hairline}` }}>
                  <Settings2 size={13} /> Positions
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowInvitePanel(true)} className="ros-surface-btn inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textMuted, border: `1px solid ${theme.hairline}` }}>
                  <UserPlus size={13} /> Invites {invites.length > 0 ? `(${invites.length})` : ""}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="ros-surface-btn inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textMuted, border: `1px solid ${theme.hairline}` }}>
                <Download size={13} /> Export CSV
              </button>
              {isAdmin && (
                <button onClick={resetAll} className="ros-danger-btn inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors" style={{ color: theme.textFaint, border: `1px solid ${theme.hairline}` }}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </div>

          {showLegend && (
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORIES.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1" style={{ background: `${c.color}18`, color: c.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} /> {c.label}
                </span>
              ))}
            </div>
          )}

          {schedule.rows.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ border: `1px dashed ${theme.hairlineLight}` }}>
              {isAdmin ? (
                <>
                  <p className="text-sm mb-4" style={{ color: theme.textMuted }}>No cues yet on {activeDay.label}. Build the schedule by adding your first cue.</p>
                  <button onClick={() => addCue(activeDay.id, 0)} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: theme.amber, color: "#1A1204" }}>
                    <Plus size={15} /> Add first cue
                  </button>
                </>
              ) : (
                <p className="text-sm" style={{ color: theme.textMuted }}>No cues yet on {activeDay.label}. Check back once your Stage Manager builds the schedule.</p>
              )}
            </div>
          ) : (
            <div>
              {isAdmin && <InsertDivider onInsert={() => addCue(activeDay.id, 0)} />}
              {schedule.rows.map((row, i) => {
                const liveStatus = nowExtended == null ? null : nowExtended >= row.startSec && nowExtended < row.endSec ? "live" : nowExtended >= row.endSec ? "past" : null;
                return (
                  <React.Fragment key={row.id}>
                    <CueRow
                      cue={row} index={i} total={schedule.rows.length} isAdmin={isAdmin} isGuest={isGuest}
                      myPositionId={myPosition?.id} myPosition={myPosition} positions={positions}
                      authorName={myMembership?.display_name}
                      onUpdate={(patch) => updateCue(row.id, patch)}
                      onDelete={() => { if (window.confirm(`Delete "${row.name}"?`)) deleteCue(row.id); }}
                      onDuplicate={() => duplicateCue(activeDay.id, row.id)}
                      onMove={(dir) => {
                        const ids = activeDay.cues.map((c) => c.id);
                        const idx = ids.indexOf(row.id);
                        const newIdx = idx + dir;
                        if (newIdx < 0 || newIdx >= ids.length) return;
                        const [item] = ids.splice(idx, 1);
                        ids.splice(newIdx, 0, item);
                        reorderCues(activeDay.id, ids);
                      }}
                      isDragOver={dragOverIndex === i} isDragging={dragIndex === i}
                      expanded={expandedIds.has(row.id)} onToggleExpand={() => toggleExpand(row.id)}
                      liveStatus={liveStatus}
                      onAddNote={(cueId, positionId, text) => addNote(cueId, positionId, text, myMembership?.display_name)}
                      onDeleteNote={(noteId) => deleteNote(noteId)}
                      dragHandlers={{
                        onDragStart: (e) => { dragIndexRef.current = i; setDragIndex(i); e.dataTransfer.effectAllowed = "move"; },
                        onDragOver: (e) => { e.preventDefault(); setDragOverIndex(i); },
                        onDrop: (e) => { e.preventDefault(); onDrop(i); },
                        onDragEnd: () => { dragIndexRef.current = null; setDragIndex(null); setDragOverIndex(null); },
                      }}
                    />
                    {isAdmin ? <InsertDivider onInsert={() => addCue(activeDay.id, i + 1)} /> : <div className="h-3" />}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div className="text-center mt-6 space-y-0.5">
            <div className="text-[11px]" style={{ color: theme.textFaint }}>Live sync • {schedule.rows.length} cue{schedule.rows.length !== 1 ? "s" : ""} on {activeDay.label}</div>
            <div className="text-[11px]" style={{ color: theme.textFaint }}>Notes are scoped to your position — the Stage Manager can see everything.</div>
          </div>
        </div>
      )}
    </div>
  );
}
