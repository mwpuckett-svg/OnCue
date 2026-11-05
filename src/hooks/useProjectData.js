import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { PALETTE } from "../lib/theme.js";
import { ask, notify } from "../lib/confirm.js";

function assemble(positions, days, cues, notes) {
  const notesByCue = {};
  for (const n of notes) {
    if (!notesByCue[n.cue_id]) notesByCue[n.cue_id] = [];
    notesByCue[n.cue_id].push({ id: n.id, text: n.text, author: n.author_name, ts: n.created_at, positionId: n.position_id });
  }
  const cuesByDay = {};
  for (const c of cues) {
    const roleNotes = {};
    positions.forEach((p) => { roleNotes[p.id] = (notesByCue[c.id] || []).filter((n) => n.positionId === p.id); });
    const cue = {
      id: c.id, name: c.name, category: c.category, durationSec: c.duration_sec,
      owner: c.owner, notes: c.notes, locked: c.locked, lockedTime: c.locked_time,
      actualStart: c.actual_start ? Date.parse(c.actual_start) : null, actualEnd: c.actual_end ? Date.parse(c.actual_end) : null,
      sortOrder: c.sort_order, roleNotes,
    };
    if (!cuesByDay[c.day_id]) cuesByDay[c.day_id] = [];
    cuesByDay[c.day_id].push(cue);
  }
  Object.values(cuesByDay).forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));

  const fullDays = days
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => ({
      id: d.id, label: d.label, date: d.date || "", startTime: d.start_time, targetEnd: d.target_end,
      liveCueId: d.live_cue_id || null, liveStartedAt: d.live_started_at ? Date.parse(d.live_started_at) : null,
      cues: cuesByDay[d.id] || [],
    }));

  return fullDays;
}

export function useProjectData(projectId, user) {
  const [project, setProject] = useState(null);
  const [positions, setPositions] = useState([]);
  const [days, setDays] = useState([]);
  const [invites, setInvites] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const editingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    // Days first: cues and notes are filtered by day id rather than by embedding "days", because cues and
    // days reference each other (days.live_cue_id) and PostgREST can't pick between the two relationships.
    const [proj, pos, dayRows, inv, mem] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("positions").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("days").select("*").eq("project_id", projectId),
      supabase.from("invites").select("*").eq("project_id", projectId),
      supabase.from("project_members").select("*").eq("project_id", projectId),
    ]);
    const dayList = dayRows.data || [];
    const dayIds = dayList.map((d) => d.id);
    const [cueRows, noteRows] = dayIds.length
      ? await Promise.all([
          supabase.from("cues").select("*").in("day_id", dayIds),
          supabase.from("cue_notes").select("*, cues!inner(day_id)").in("cues.day_id", dayIds),
        ])
      : [{ data: [] }, { data: [] }];
    if (cueRows.error || noteRows.error) console.error("OnCue: couldn't load cues", cueRows.error || noteRows.error);
    if (proj.data) setProject(proj.data);
    const posList = pos.data || [];
    setPositions(posList);
    setDays(assemble(posList, dayList, cueRows.data || [], noteRows.data || []));
    setInvites(inv.data || []);
    setMembers(mem.data || []);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refetch();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => { if (!editingRef.current) refetch(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => { if (!editingRef.current) refetch(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "days" }, () => { if (!editingRef.current) refetch(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "cues" }, () => { if (!editingRef.current) refetch(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "cue_notes" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "invites" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, () => refetch())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId, user, refetch]);

  const myMembership = members.find((m) => m.user_id === user?.id) || null;

  /* ---- show ---- */
  const updateShow = useCallback(async (patch) => {
    setProject((p) => ({ ...p, ...patch }));
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.venue !== undefined) dbPatch.venue = patch.venue;
    if (patch.date !== undefined) dbPatch.date = patch.date || null;
    await supabase.from("projects").update({ ...dbPatch, updated_at: new Date().toISOString() }).eq("id", projectId);
  }, [projectId]);

  /* ---- positions ---- */
  const addPosition = useCallback(async (label) => {
    await supabase.from("positions").insert({
      project_id: projectId, label, color: PALETTE[positions.length % PALETTE.length],
      is_admin: false, sort_order: positions.length,
    });
    refetch();
  }, [projectId, positions.length, refetch]);

  const renamePosition = useCallback(async (id, label) => {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, label } : p)));
    await supabase.from("positions").update({ label }).eq("id", id);
  }, []);

  const recolorPosition = useCallback(async (id) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    const idx = PALETTE.indexOf(pos.color);
    const color = PALETTE[(idx + 1 + PALETTE.length) % PALETTE.length];
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
    await supabase.from("positions").update({ color }).eq("id", id);
  }, [positions]);

  const toggleAdminPosition = useCallback(async (id) => {
    const target = positions.find((p) => p.id === id);
    if (!target) return;
    const adminCount = positions.filter((p) => p.is_admin).length;
    if (target.is_admin && adminCount <= 1) {
      notify("Keep at least one admin", "Make another position an admin first, then remove admin from this one.");
      return;
    }
    await supabase.from("positions").update({ is_admin: !target.is_admin }).eq("id", id);
    refetch();
  }, [positions, refetch]);

  const deletePosition = useCallback(async (id) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    const adminCount = positions.filter((p) => p.is_admin).length;
    if (pos.is_admin && adminCount <= 1) {
      notify("This is the last admin position", "Make another position an admin before you remove this one.");
      return;
    }
    if (!(await ask({ title: `Remove ${pos.label}?`, body: "Notes written under this position are deleted with it.", confirmLabel: "Remove position", danger: true }))) return;
    await supabase.from("positions").delete().eq("id", id);
    refetch();
  }, [positions, refetch]);

  /* ---- days ---- */
  const addDay = useCallback(async () => {
    const { data } = await supabase.from("days").insert({
      project_id: projectId, label: `Day ${days.length + 1}`, start_time: "18:00", target_end: "", sort_order: days.length,
    }).select().single();
    await refetch();
    return data?.id;
  }, [projectId, days.length, refetch]);

  const updateDay = useCallback(async (dayId, patch) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
    const dbPatch = {};
    if (patch.label !== undefined) dbPatch.label = patch.label;
    if (patch.date !== undefined) dbPatch.date = patch.date || null;
    if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
    if (patch.targetEnd !== undefined) dbPatch.target_end = patch.targetEnd;
    await supabase.from("days").update(dbPatch).eq("id", dayId);
  }, []);

  /**
   * GO button. Moves the live cue from one cue to another and records when each cue really started and ended.
   * from: the cue being left. to: the cue being called (null ends the show).
   * back: stepping backwards, so the cue being left goes back to "not run yet".
   * reset: starting a fresh run, so every cue on the day forgets its old actual times.
   */
  const callCue = useCallback(async (dayId, { from = null, to = null, back = false, reset = false } = {}) => {
    const now = Date.now();
    const iso = new Date(now).toISOString();
    setDays((prev) => prev.map((d) => {
      if (d.id !== dayId) return d;
      const cues = d.cues.map((c) => {
        if (c.id === to) return { ...c, actualStart: now, actualEnd: null };
        if (reset) return { ...c, actualStart: null, actualEnd: null };
        if (c.id === from) return back ? { ...c, actualStart: null, actualEnd: null } : { ...c, actualEnd: now };
        return c;
      });
      return { ...d, liveCueId: to, liveStartedAt: to ? now : null, cues };
    }));

    const results = [];
    if (reset) results.push(await supabase.from("cues").update({ actual_start: null, actual_end: null }).eq("day_id", dayId));
    const jobs = [
      supabase.from("days").update({ live_cue_id: to, live_started_at: to ? iso : null }).eq("id", dayId),
    ];
    if (from && !reset) jobs.push(supabase.from("cues").update(back ? { actual_start: null, actual_end: null } : { actual_end: iso }).eq("id", from));
    if (to) jobs.push(supabase.from("cues").update({ actual_start: iso, actual_end: null }).eq("id", to));
    results.push(...(await Promise.all(jobs)));

    const failed = results.find((r) => r.error);
    if (failed) {
      notify("GO couldn't save", `${failed.error.message}. If the message mentions live_cue_id, actual_start or actual_end, run the SQL files in supabase/migrations in the Supabase SQL editor once.`);
      refetch();
    }
  }, [refetch]);

  const deleteDay = useCallback(async (dayId) => {
    if (days.length <= 1) return;
    const day = days.find((d) => d.id === dayId);
    if (!(await ask({ title: `Delete ${day?.label || "this day"}?`, body: "Every cue and note on this day is deleted. This can't be undone.", confirmLabel: "Delete day", danger: true }))) return;
    await supabase.from("days").delete().eq("id", dayId);
    refetch();
  }, [days, refetch]);

  const duplicateDay = useCallback(async (dayId) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const { data: newDay } = await supabase.from("days").insert({
      project_id: projectId, label: `${day.label} copy`, date: day.date || null,
      start_time: day.startTime, target_end: day.targetEnd, sort_order: days.length,
    }).select().single();
    if (newDay && day.cues.length) {
      await supabase.from("cues").insert(day.cues.map((c, i) => ({
        day_id: newDay.id, sort_order: i, name: c.name, category: c.category, duration_sec: c.durationSec,
        owner: c.owner, notes: c.notes, locked: c.locked, locked_time: c.lockedTime,
      })));
    }
    await refetch();
    return newDay?.id;
  }, [days, projectId, refetch]);

  /* ---- cues ---- */
  const addCue = useCallback(async (dayId, atIndex) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    const idx = atIndex == null ? day.cues.length : atIndex;
    // shift sort_order of cues at/after idx
    const toShift = day.cues.slice(idx);
    await Promise.all(toShift.map((c) => supabase.from("cues").update({ sort_order: c.sortOrder + 1 }).eq("id", c.id)));
    const { error } = await supabase.from("cues").insert({
      day_id: dayId, sort_order: idx, name: "New cue", category: "segment", duration_sec: 300,
      owner: "", notes: "", locked: false, locked_time: "",
    });
    if (error) notify("Couldn't add the cue", `${error.message}. If this keeps happening, check that your position is an admin position.`);
    refetch();
  }, [days, refetch]);

  const updateCue = useCallback(async (cueId, patch) => {
    setDays((prev) => prev.map((d) => ({ ...d, cues: d.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c)) })));
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.durationSec !== undefined) dbPatch.duration_sec = patch.durationSec;
    if (patch.owner !== undefined) dbPatch.owner = patch.owner;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.locked !== undefined) dbPatch.locked = patch.locked;
    if (patch.lockedTime !== undefined) dbPatch.locked_time = patch.lockedTime;
    await supabase.from("cues").update(dbPatch).eq("id", cueId);
  }, []);

  const deleteCue = useCallback(async (cueId) => {
    await supabase.from("cues").delete().eq("id", cueId);
    refetch();
  }, [refetch]);

  const duplicateCue = useCallback(async (dayId, cueId) => {
    const day = days.find((d) => d.id === dayId);
    const cue = day?.cues.find((c) => c.id === cueId);
    if (!cue) return;
    const idx = day.cues.findIndex((c) => c.id === cueId);
    const toShift = day.cues.slice(idx + 1);
    await Promise.all(toShift.map((c) => supabase.from("cues").update({ sort_order: c.sortOrder + 1 }).eq("id", c.id)));
    await supabase.from("cues").insert({
      day_id: dayId, sort_order: idx + 1, name: cue.name + " (copy)", category: cue.category,
      duration_sec: cue.durationSec, owner: cue.owner, notes: cue.notes, locked: cue.locked, locked_time: cue.lockedTime,
    });
    refetch();
  }, [days, refetch]);

  const reorderCues = useCallback(async (dayId, orderedCueIds) => {
    setDays((prev) => prev.map((d) => {
      if (d.id !== dayId) return d;
      const byId = Object.fromEntries(d.cues.map((c) => [c.id, c]));
      return { ...d, cues: orderedCueIds.map((id) => byId[id]).filter(Boolean) };
    }));
    await Promise.all(orderedCueIds.map((id, i) => supabase.from("cues").update({ sort_order: i }).eq("id", id)));
  }, []);

  /* ---- notes ---- */
  const addNote = useCallback(async (cueId, positionId, text, authorName) => {
    await supabase.from("cue_notes").insert({
      cue_id: cueId, position_id: positionId, text, author_name: authorName || "", author_user_id: user?.id,
    });
  }, [user]);

  const deleteNote = useCallback(async (noteId) => {
    await supabase.from("cue_notes").delete().eq("id", noteId);
  }, []);

  /* ---- invites ---- */
  const addInvite = useCallback(async (email, positionId, isGuest) => {
    await supabase.from("invites").upsert(
      { project_id: projectId, email, position_id: isGuest ? null : positionId, is_guest: !!isGuest },
      { onConflict: "project_id,email" }
    );
    refetch();
  }, [projectId, refetch]);

  const removeInvite = useCallback(async (inviteId) => {
    await supabase.from("invites").delete().eq("id", inviteId);
    refetch();
  }, [refetch]);

  /* ---- membership (joining a project) ---- */
  const joinProject = useCallback(async (positionId, isGuest, displayName) => {
    const { error } = await supabase.from("project_members").insert({
      project_id: projectId, user_id: user.id, position_id: isGuest ? null : positionId,
      is_guest: !!isGuest, display_name: displayName || "",
    });
    if (error) throw error;
    await refetch();
  }, [projectId, user, refetch]);

  const updateMyMembership = useCallback(async (patch) => {
    if (!myMembership) return;
    const dbPatch = {};
    if (patch.positionId !== undefined) dbPatch.position_id = patch.positionId;
    if (patch.isGuest !== undefined) dbPatch.is_guest = patch.isGuest;
    if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName;
    await supabase.from("project_members").update(dbPatch).eq("id", myMembership.id);
    refetch();
  }, [myMembership, refetch]);

  return {
    project, positions, days, invites, members, myMembership, loading, editingRef,
    updateShow, addPosition, renamePosition, recolorPosition, toggleAdminPosition, deletePosition,
    addDay, updateDay, deleteDay, duplicateDay, callCue,
    addCue, updateCue, deleteCue, duplicateCue, reorderCues,
    addNote, deleteNote, addInvite, removeInvite, joinProject, updateMyMembership,
  };
}
