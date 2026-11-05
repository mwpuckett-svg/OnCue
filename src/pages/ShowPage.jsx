import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Download, Printer, ChevronDown, UserPlus, Users, Copy, Trash2 } from "lucide-react";
import { catOf } from "../lib/theme.js";
import {
  formatDateShort, clockLabel, timeStrToMinutes, secondsToMMSS, secondsToRuntimeLabel,
  computeSchedule, todayLocalStr, formatNoteTime,
} from "../lib/scheduleUtils.js";
import { ask } from "../lib/confirm.js";
import { Button, IconBtn, LoadingBlock, InsertSlot, TimeField, ThemeToggle } from "../components/ui.jsx";
import DayTabs from "../components/DayTabs.jsx";
import CueRow from "../components/CueRow.jsx";
import InvitePanel from "../components/InvitePanel.jsx";
import PositionsPanel from "../components/PositionsPanel.jsx";
import JoinGate from "../components/JoinGate.jsx";
import GoBar from "../components/GoBar.jsx";
import PrintView from "../components/PrintView.jsx";

function Stat({ label, children, note, noteTone }) {
  return (
    <div className="border-b border-rule py-2.5 pr-3 max-sm:last:col-span-2 even:border-l even:pl-4 sm:border-b-0 sm:border-l sm:px-6 sm:py-3 sm:first:border-l-0 sm:first:pl-0">
      <div className="text-xs text-mute">{label}</div>
      <div className="clock num text-[1.75rem] leading-8 sm:text-[2.25rem] sm:leading-[2.5rem]">{children}</div>
      {note && <div className={`mt-0.5 text-xs font-medium ${noteTone || "text-mute"}`}>{note}</div>}
    </div>
  );
}

export default function ShowPage({ data, user, onGoToProjects }) {
  const {
    project, positions, days, invites, myMembership, loading, editingRef,
    updateShow, addPosition, renamePosition, recolorPosition, toggleAdminPosition, deletePosition,
    addDay, updateDay, deleteDay, duplicateDay, callCue,
    addCue, updateCue, deleteCue, duplicateCue, reorderCues,
    addNote, deleteNote, addInvite, removeInvite, joinProject, updateMyMembership,
  } = data;

  const [activeDayId, setActiveDayId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showPositionsPanel, setShowPositionsPanel] = useState(false);
  const [showSwitchGate, setShowSwitchGate] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const dragIndexRef = useRef(null);
  const awaitingNewCue = useRef(false);
  const knownCueIds = useRef(new Set());
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

  // ----- GO button -----
  const liveIdx = activeDay.liveCueId ? schedule.rows.findIndex((r) => r.id === activeDay.liveCueId) : -1;
  const manualLive = liveIdx >= 0;
  const scrollToLive = useRef(false);

  const goNext = () => {
    if (!activeDay.id || schedule.rows.length === 0) return;
    const rows = schedule.rows;
    scrollToLive.current = true;
    if (!manualLive) callCue(activeDay.id, { to: rows[0].id, reset: true });
    else if (liveIdx < rows.length - 1) callCue(activeDay.id, { from: rows[liveIdx].id, to: rows[liveIdx + 1].id });
    else { scrollToLive.current = false; callCue(activeDay.id, { from: rows[liveIdx].id, to: null }); }
  };
  const goBack = () => {
    if (!manualLive) return;
    scrollToLive.current = true;
    const rows = schedule.rows;
    callCue(activeDay.id, { from: rows[liveIdx].id, to: liveIdx > 0 ? rows[liveIdx - 1].id : null, back: true });
  };
  const endShow = async () => {
    const ok = await ask({ title: "End the show?", body: "The live cue is cleared for everyone. The schedule goes back to following the clock.", confirmLabel: "End show", danger: true });
    if (ok) callCue(activeDay.id, { from: schedule.rows[liveIdx]?.id, to: null });
  };

  // Space calls the next cue once the show is live, as long as you aren't typing or in a dialog.
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  useEffect(() => {
    if (!isAdmin || !manualLive) return undefined;
    const onKey = (e) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      goNextRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, manualLive]);

  // The person who pressed GO gets the new live row brought into view.
  useEffect(() => {
    if (!scrollToLive.current || !activeDay.liveCueId) return;
    scrollToLive.current = false;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-cue-id="${activeDay.liveCueId}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }, [activeDay.liveCueId]);

  // After "Add cue", bring the new row into view and put the cursor in its name field.
  useEffect(() => {
    const ids = (activeDay.cues || []).map((c) => c.id);
    if (awaitingNewCue.current) {
      const fresh = ids.find((id) => !knownCueIds.current.has(id));
      if (fresh) {
        awaitingNewCue.current = false;
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-cue-id="${fresh}"]`);
          if (!el) return;
          el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          const input = el.querySelector('input[aria-label="Cue name"]');
          if (input) { input.focus({ preventScroll: true }); input.select(); }
        });
      }
    }
    knownCueIds.current = new Set(ids);
  }, [activeDay.cues]);

  const requestNewCue = (index) => {
    awaitingNewCue.current = true;
    setTimeout(() => { awaitingNewCue.current = false; }, 5000);
    addCue(activeDay.id, index);
  };

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
    const actualLen = (r) => (r.actualStart && r.actualEnd ? secondsToMMSS(Math.round((r.actualEnd - r.actualStart) / 1000)) : "");
    const overBy = (r) => {
      if (!(r.actualStart && r.actualEnd)) return "";
      const o = Math.round((r.actualEnd - r.actualStart) / 1000) - r.durationSec;
      return o === 0 ? "0:00" : o > 0 ? `+${secondsToMMSS(o)}` : `-${secondsToMMSS(-o)}`;
    };
    const header = ["#", "Category", "Item", "Duration", "Start", "End", "Presenter", "Actual length", "Over (+) or under (-)", "General Notes", ...positions.map((p) => p.label + " Notes"), "Locked"];
    const lines = [header.join(",")];
    schedule.rows.forEach((r, i) => {
      const vals = [
        i + 1, catOf(r.category).label, r.name, secondsToMMSS(r.durationSec),
        clockLabel(Math.round(r.startSec / 60)), clockLabel(Math.round(r.endSec / 60)),
        r.owner || "", actualLen(r), overBy(r), r.notes || "", ...positions.map((p) => fmtNotes(r.roleNotes[p.id])), r.locked ? "Y" : "N",
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
    const ok = await ask({
      title: `Reset ${project.name}?`,
      body: "This clears every day, invite and cue in this show. Other shows aren't touched. It can't be undone.",
      confirmLabel: "Reset show", danger: true,
    });
    if (!ok) return;
    for (const d of days.slice(1)) await deleteDay(d.id);
    const first = days[0];
    if (first) for (const c of first.cues) await deleteCue(c.id);
    for (const inv of invites) await removeInvite(inv.id);
  };

  const removeCue = async (row) => {
    const ok = await ask({ title: `Delete ${row.name || "this cue"}?`, body: "Its notes go with it.", confirmLabel: "Delete cue", danger: true });
    if (ok) deleteCue(row.id);
  };

  const variance = schedule.variance;
  const overUnder = variance == null ? null
    : Math.abs(variance) <= 60 ? { text: "On target", tone: "text-ok" }
    : variance > 0 ? { text: `${secondsToRuntimeLabel(variance)} over target`, tone: "text-signal" }
    : { text: `${secondsToRuntimeLabel(-variance)} under target`, tone: "text-ok" };

  const needsJoin = !myMembership;
  const roleLabel = isGuest ? "Guest" : myPosition?.label || "Choose position";

  return (
    <div className="min-h-screen print:min-h-0">
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
        <PrintView
          project={project} day={activeDay} schedule={schedule} positions={positions} expandedIds={expandedIds}
        />
      )}

      {!needsJoin && (
        <div
          className="print:hidden"
          onFocusCapture={(e) => { if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) editingRef.current = true; }}
          onBlurCapture={(e) => { if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) editingRef.current = false; }}
        >
          {/* App bar */}
          <div className="no-print mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <div className="flex items-center gap-4">
              <span className="font-display text-[1.375rem] font-bold leading-none">OnCue</span>
              <button onClick={onGoToProjects} className="text-sm text-mute underline-offset-4 transition-colors hover:text-ink hover:underline">All shows</button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="quiet" size="sm" onClick={() => setShowSwitchGate(true)} aria-label="Change your position">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: isGuest ? "rgb(var(--faint))" : myPosition?.color || "rgb(var(--faint))" }} aria-hidden="true" />
                {roleLabel}
                <ChevronDown size={13} />
              </Button>
              <ThemeToggle />
            </div>
          </div>

          <main className="mx-auto max-w-[1360px] border-x border-t border-rule bg-paper min-h-[calc(100vh-3rem)]">
            {/* Title block */}
            <section className="px-4 pt-5 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
                <div className="min-w-[16rem] flex-1">
                  {isAdmin ? (
                    <input
                      value={project.name}
                      onChange={(e) => updateShow({ name: e.target.value })}
                      placeholder="Untitled show"
                      aria-label="Show name"
                      className="field clock !text-[2.75rem] !leading-[3rem] !font-semibold"
                    />
                  ) : (
                    <h1 className="clock text-[2.75rem] leading-[3rem]">{project.name}</h1>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-5 text-sm text-mute">
                    {isAdmin ? (
                      <>
                        <input value={project.venue || ""} onChange={(e) => updateShow({ venue: e.target.value })} placeholder="Add venue" aria-label="Venue" className="field !w-72 max-w-full" />
                        <input type="date" value={project.date || ""} onChange={(e) => updateShow({ date: e.target.value })} aria-label="Show date" className="field !w-40" />
                      </>
                    ) : (
                      <>
                        {project.venue && <span>{project.venue}</span>}
                        {project.date && <span>{formatDateShort(project.date)}</span>}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid w-full grid-cols-2 border-t border-rule sm:flex sm:w-auto sm:border-t-0">
                  <Stat label="Now">{isLiveDay ? clockLabel(Math.floor(nowSecRaw / 60)) : "No clock"}</Stat>
                  <Stat label="Starts">
                    {isAdmin ? (
                      <TimeField value={activeDay.startTime} onChange={(v) => v && updateDay(activeDay.id, { startTime: v })} label="Start time" className="field clock !w-[9rem] !text-[2.25rem] !leading-[2.5rem]" />
                    ) : clockLabel(timeStrToMinutes(activeDay.startTime))}
                  </Stat>
                  <Stat label="Runs">{secondsToRuntimeLabel(schedule.totalSec)}</Stat>
                  <Stat label="Ends" note={overUnder?.text} noteTone={overUnder?.tone}>
                    {clockLabel(Math.round(schedule.endSec / 60))}
                  </Stat>
                  <Stat label="Target end">
                    {isAdmin ? (
                      <TimeField value={activeDay.targetEnd} onChange={(v) => updateDay(activeDay.id, { targetEnd: v })} label="Target end time" placeholder="Not set" className="field clock !w-[9rem] !text-[2.25rem] !leading-[2.5rem] !text-mute" />
                    ) : <span className="text-mute">{activeDay.targetEnd ? clockLabel(timeStrToMinutes(activeDay.targetEnd)) : "Not set"}</span>}
                  </Stat>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-rule">
                <DayTabs days={days} activeDayId={activeDay.id} onSelect={(id) => { awaitingNewCue.current = false; setActiveDayId(id); }} isAdmin={isAdmin} onAdd={addDay} />
                {isAdmin && (
                  <div className="no-print mb-2 flex items-center gap-1 text-sm text-mute">
                    <input value={activeDay.label} onChange={(e) => updateDay(activeDay.id, { label: e.target.value })} aria-label="Day name" className="field !w-28" />
                    <input type="date" value={activeDay.date || ""} onChange={(e) => updateDay(activeDay.id, { date: e.target.value })} aria-label="Day date" className="field !w-36" />
                    <IconBtn onClick={() => duplicateDay(activeDay.id)} title="Duplicate day"><Copy size={14} /></IconBtn>
                    <IconBtn onClick={() => deleteDay(activeDay.id)} title="Delete day" danger disabled={days.length <= 1}><Trash2 size={14} /></IconBtn>
                  </div>
                )}
              </div>
            </section>

            {/* Toolbar */}
            <div className="no-print scroll-thin flex items-center gap-2 overflow-x-auto border-b border-rule px-4 py-2 sm:flex-wrap sm:justify-between sm:overflow-visible sm:px-6 [&_button]:shrink-0">
              <div className="flex items-center gap-1 sm:flex-wrap">
                {isAdmin && (
                  <Button variant="primary" onClick={() => requestNewCue(schedule.rows.length)} className="mr-2">
                    <Plus size={15} strokeWidth={2.25} /> Add cue
                  </Button>
                )}
                {schedule.rows.length > 0 && (
                  <Button onClick={toggleExpandAll}>{allExpanded ? "Collapse notes" : "Expand notes"}</Button>
                )}
                {isAdmin && <Button onClick={() => setShowPositionsPanel(true)}><Users size={14} /> Crew positions</Button>}
                {isAdmin && <Button onClick={() => setShowInvitePanel(true)}><UserPlus size={14} /> Invites{invites.length > 0 ? ` (${invites.length})` : ""}</Button>}
              </div>
              <div className="flex items-center gap-1 sm:ml-auto">
                <Button onClick={exportCSV}><Download size={14} /> Export CSV</Button>
                <Button onClick={() => window.print()}><Printer size={14} /> Print</Button>
              </div>
            </div>

            <div className="z-30 bg-paper sm:sticky sm:top-0">
            <GoBar
              rows={schedule.rows} liveIdx={liveIdx} liveStartedAt={activeDay.liveStartedAt} nowMs={now.getTime()}
              isAdmin={isAdmin} onGo={goNext} onBack={goBack} onEnd={endShow}
            />

            {/* Column heads */}
            {schedule.rows.length > 0 && (
              <div className="cue-cols hidden border-b border-rule-strong bg-sunk px-6 py-1.5 text-xs font-medium text-mute min-[1100px]:grid" style={{ gridTemplateAreas: '"idx start end dur name cat owner notes act"' }}>
                <div style={{ gridArea: "idx" }}>#</div>
                <div style={{ gridArea: "start" }}>Start</div>
                <div style={{ gridArea: "end" }}>End</div>
                <div style={{ gridArea: "dur" }}>Length</div>
                <div style={{ gridArea: "name" }}>Cue</div>
                <div style={{ gridArea: "cat" }}>Category</div>
                <div style={{ gridArea: "owner" }}>Presenter</div>
                <div style={{ gridArea: "notes" }}>Notes</div>
              </div>
            )}
            </div>

            {schedule.rows.length === 0 ? (
              <div className="px-4 py-16 sm:px-6">
                <p className="font-display text-2xl font-semibold">{activeDay.label} has no cues yet</p>
                {isAdmin ? (
                  <>
                    <p className="mb-5 mt-1 max-w-md text-sm text-mute">Add the first cue and set its length. Every start time below it is worked out for you.</p>
                    <Button variant="primary" onClick={() => requestNewCue(0)}><Plus size={15} strokeWidth={2.25} /> Add first cue</Button>
                  </>
                ) : (
                  <p className="mt-1 max-w-md text-sm text-mute">Check back once the stage manager has built the schedule.</p>
                )}
              </div>
            ) : (
              <div>
                {isAdmin && <InsertSlot onInsert={() => requestNewCue(0)} />}
                {schedule.rows.map((row, i) => {
                  // Once the stage manager has pressed GO, the live cue follows GO. Before that it follows the clock.
                  const liveStatus = manualLive
                    ? i === liveIdx ? "live" : i < liveIdx ? "past" : null
                    : nowExtended == null ? null : nowExtended >= row.startSec && nowExtended < row.endSec ? "live" : nowExtended >= row.endSec ? "past" : null;
                  const progress = liveStatus === "live"
                    ? manualLive ? (now.getTime() - activeDay.liveStartedAt) / 1000 / Math.max(1, row.durationSec) : (nowExtended - row.startSec) / Math.max(1, row.endSec - row.startSec)
                    : null;
                  // How far over its planned length this cue ran (finished cues) or is running (the live cue).
                  let overSec = 0;
                  if (manualLive && i === liveIdx) overSec = Math.floor((now.getTime() - activeDay.liveStartedAt) / 1000) - row.durationSec;
                  else if (row.actualStart && row.actualEnd) overSec = Math.round((row.actualEnd - row.actualStart) / 1000) - row.durationSec;
                  return (
                    <React.Fragment key={row.id}>
                      <CueRow
                        overSec={overSec}
                        cue={row} index={i} total={schedule.rows.length} isAdmin={isAdmin} isGuest={isGuest}
                        myPositionId={myPosition?.id} myPosition={myPosition} positions={positions}
                        authorName={myMembership?.display_name}
                        onUpdate={(patch) => updateCue(row.id, patch)}
                        onDelete={() => removeCue(row)}
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
                        liveStatus={liveStatus} progress={progress}
                        onAddNote={(cueId, positionId, text) => addNote(cueId, positionId, text, myMembership?.display_name)}
                        onDeleteNote={(noteId) => deleteNote(noteId)}
                        dragHandlers={{
                          onDragStart: (e) => { dragIndexRef.current = i; setDragIndex(i); e.dataTransfer.effectAllowed = "move"; },
                          onDragOver: (e) => { e.preventDefault(); setDragOverIndex(i); },
                          onDrop: (e) => { e.preventDefault(); onDrop(i); },
                          onDragEnd: () => { dragIndexRef.current = null; setDragIndex(null); setDragOverIndex(null); },
                        }}
                      />
                      {isAdmin && <InsertSlot onInsert={() => requestNewCue(i + 1)} />}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            <footer className="no-print flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-mute sm:px-6">
              <span>
                {schedule.rows.length} {schedule.rows.length === 1 ? "cue" : "cues"} on {activeDay.label}. Changes sync to everyone on the crew as you make them.
              </span>
              {isAdmin && <Button variant="danger" size="sm" onClick={resetAll}>Reset show</Button>}
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
