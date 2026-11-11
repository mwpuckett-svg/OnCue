import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { PALETTE } from "../lib/theme.js";
import { ask, notify } from "../lib/confirm.js";
import { readSheet, planSync, resolveColumns, titleCaseHeader, hashText } from "../lib/sheetSync.js";
import { fetchSheetCsv } from "../lib/sheetClient.js";

function assemble(positions, days, cues, notes) {
  const notesByCue = {};
  for (const n of notes) {
    if (!notesByCue[n.cue_id]) notesByCue[n.cue_id] = [];
    notesByCue[n.cue_id].push({ id: n.id, text: n.text, author: n.author_name, ts: n.created_at, positionId: n.position_id, fromSheet: !!n.from_sheet });
  }
  const cuesByDay = {};
  for (const c of cues) {
    const roleNotes = {};
    positions.forEach((p) => { roleNotes[p.id] = (notesByCue[c.id] || []).filter((n) => n.positionId === p.id); });
    const cue = {
      id: c.id, name: c.name, category: c.category, durationSec: c.duration_sec,
      owner: c.owner, notes: c.notes, locked: c.locked, lockedTime: c.locked_time,
      actualStart: c.actual_start ? Date.parse(c.actual_start) : null, actualEnd: c.actual_end ? Date.parse(c.actual_end) : null,
      sortOrder: c.sort_order, roleNotes, sheetKey: c.sheet_key || null, sheetSnapshot: c.sheet_snapshot || null,
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
      sheetId: d.sheet_id || null, sheetGid: d.sheet_gid || "0", sheetLengthFormat: d.sheet_length_format || "hm", sheetMap: d.sheet_map || {},
      sheetStart: d.sheet_start || null, sheetHash: d.sheet_hash || null, sheetSyncedAt: d.sheet_synced_at ? Date.parse(d.sheet_synced_at) : null, sheetError: d.sheet_error || null,
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


  /* ---- google sheet link ---- */
  const daysRef = useRef(days);
  daysRef.current = days;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const busySheets = useRef(new Set());
  const [sheetState, setSheetState] = useState({});
  const markSheet = (dayId, patch) => setSheetState((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] || {}), ...patch } }));

  /**
   * Pulls the day's Google Sheet into its cues. Safe to call from every admin's screen: the first one to see a new
   * version of the sheet claims it in the database, and the others skip it.
   * auto: a background refresh (never asks questions, holds back large deletions).
   * force: apply even if the sheet looks unchanged (used when linking).
   * override: day settings not saved yet (used while linking).
   */
  const syncSheet = useCallback(async (dayId, { auto = false, force = false, override = null, replaceExisting = false } = {}) => {
    const found = daysRef.current.find((d) => d.id === dayId);
    if (!found) return { status: "none" };
    const day = { ...found, ...(override || {}) };
    if (!day.sheetId || busySheets.current.has(dayId)) return { status: "none" };
    busySheets.current.add(dayId);
    markSheet(dayId, { checking: true });
    const fail = async (message) => {
      markSheet(dayId, { checking: false, error: message, checkedAt: Date.now() });
      if (!auto) notify("Couldn't sync the sheet", message);
      // Only write when the message is new, so a sheet that stays broken doesn't churn the database every refresh.
      if (found.sheetError !== message) { await supabase.from("days").update({ sheet_error: message }).eq("id", dayId); refetch(); }
      return { status: "error", message };
    };
    try {
      let csv;
      try { csv = await fetchSheetCsv(day.sheetId, day.sheetGid); } catch (e) { return await fail(e.message); }
      const hash = hashText(csv);
      if (!force && hash === day.sheetHash && !day.sheetError) {
        markSheet(dayId, { checking: false, error: null, checkedAt: Date.now() });
        return { status: "same" };
      }

      const parsed = readSheet(csv, { lengthFormat: day.sheetLengthFormat });
      if (!parsed.ok) return await fail(parsed.error);
      const hadSheetCues = day.cues.some((c) => c.sheetKey);
      if (!parsed.cues.length && hadSheetCues) return await fail("The sheet has no cues in it right now, so nothing was changed.");

      // The day as the plan should see it. When replacing, everything not yet run is cleared first.
      const planDay = replaceExisting ? { ...day, cues: day.cues.filter((c) => c.actualStart) } : day;
      const columns = resolveColumns(parsed.deptHeaders, positionsRef.current, day.sheetMap).map((c) => (c.action === "new" ? { ...c, positionId: `new:${c.header}` } : c));
      const plan = planSync({ parsed, day: planDay, columns });

      const keyedCount = day.cues.filter((c) => c.sheetKey).length;
      if (!force && plan.remove.length && (plan.remove.length >= 5 && plan.remove.length > keyedCount / 2)) {
        if (auto) return await fail(`${plan.remove.length} cues are missing from the sheet. Open Google Sheet and choose Sync now to review.`);
        const ok = await ask({ title: `Remove ${plan.remove.length} cues?`, body: "They are no longer in the Google Sheet. Cues already run on the live show are kept.", confirmLabel: "Remove and sync", danger: true });
        if (!ok) { markSheet(dayId, { checking: false }); return { status: "cancelled" }; }
      } else if (!auto && !force && plan.remove.length) {
        const ok = await ask({ title: `Remove ${plan.remove.length} ${plan.remove.length === 1 ? "cue" : "cues"}?`, body: "Not in the Google Sheet any more. Cues already run on the live show are kept.", confirmLabel: "Remove and sync", danger: true });
        if (!ok) { markSheet(dayId, { checking: false }); return { status: "cancelled" }; }
      }

      // Claim this version of the sheet so two admins don't both apply it.
      if (!force) {
        const claim = await supabase.from("days").update({ sheet_hash: hash }).eq("id", dayId).or(`sheet_hash.is.null,sheet_hash.neq.${hash}`).select("id");
        if (claim.error) return await fail(claim.error.message);
        if (!claim.data || !claim.data.length) { markSheet(dayId, { checking: false, checkedAt: Date.now() }); return { status: "claimed-elsewhere" }; }
      }

      const results = [];

      // Crew columns that don't match a position yet become new positions.
      const map = { ...(day.sheetMap || {}) };
      const created = {};
      const toCreate = columns.filter((c) => c.action === "new");
      for (let i = 0; i < toCreate.length; i++) {
        const c = toCreate[i];
        const label = titleCaseHeader(c.header);
        const r = await supabase.from("positions").insert({
          project_id: projectId, label, color: PALETTE[(positionsRef.current.length + i) % PALETTE.length], is_admin: false, sort_order: positionsRef.current.length + i,
        }).select("id").single();
        if (r.error) { await supabase.from("days").update({ sheet_hash: null }).eq("id", dayId); return await fail(r.error.message); }
        created[`new:${c.header}`] = r.data.id;
      }
      columns.forEach((c) => { if (c.action === "skip") map[c.header] = "skip"; else map[c.header] = created[c.positionId] || c.positionId; });
      const realPos = (pid) => created[pid] || pid;

      if (replaceExisting) {
        const ids = day.cues.filter((c) => !c.actualStart).map((c) => c.id);
        if (ids.length) results.push(await supabase.from("cues").delete().in("id", ids));
      }

      // Cues
      const idByKey = new Map(planDay.cues.filter((c) => c.sheetKey).map((c) => [c.sheetKey, c.id]));
      if (plan.insert.length) {
        const ins = await supabase.from("cues").upsert(
          plan.insert.map((c) => ({
            day_id: dayId, sort_order: c.sortOrder, name: c.name, category: "segment", duration_sec: c.durationSec,
            owner: c.owner, notes: c.notes, locked: false, locked_time: "", sheet_key: c.key, sheet_snapshot: c.snapshot,
          })),
          { onConflict: "day_id,sheet_key" }
        ).select("id, sheet_key");
        results.push(ins);
        (ins.data || []).forEach((r) => idByKey.set(r.sheet_key, r.id));
      }
      results.push(...(await Promise.all(plan.update.map((u) => supabase.from("cues").update(u.snapshot ? { ...u.patch, sheet_snapshot: u.snapshot } : u.patch).eq("id", u.id)))));
      if (plan.remove.length) results.push(await supabase.from("cues").delete().in("id", plan.remove));

      // Crew notes from the sheet's columns
      const existingNotes = new Map();
      planDay.cues.forEach((c) => Object.values(c.roleNotes || {}).flat().forEach((n) => {
        if (!n.fromSheet) return;
        const k = `${c.id}|${n.positionId}`;
        existingNotes.set(k, [...(existingNotes.get(k) || []), n]);
      }));
      const delNotes = [];
      const addNotes = [];
      plan.noteWants.forEach((w) => {
        const cueId = idByKey.get(w.cueKey);
        const pid = realPos(w.positionId);
        if (!cueId) return;
        const have = existingNotes.get(`${cueId}|${pid}`) || [];
        if (have.length === 1 && have[0].text === w.text) return;
        have.forEach((n) => delNotes.push(n.id));
        if (w.text) addNotes.push({ cue_id: cueId, position_id: pid, text: w.text, author_name: "Google Sheet", author_user_id: user?.id, from_sheet: true });
      });
      // Notes under cues that were removed or whose column is no longer mapped go away with them (cascade / below).
      if (delNotes.length) results.push(await supabase.from("cue_notes").delete().in("id", delNotes));
      if (addNotes.length) results.push(await supabase.from("cue_notes").insert(addNotes));

      const failed = results.find((r) => r && r.error);
      if (failed) {
        await supabase.from("days").update({ sheet_hash: null }).eq("id", dayId);
        return await fail(failed.error.message);
      }

      const now = new Date().toISOString();
      const dayUpdate = await supabase.from("days").update({
        ...plan.dayPatch, sheet_start: parsed.startTime || day.sheetStart || null, sheet_hash: hash, sheet_synced_at: now,
        sheet_error: null, sheet_map: map,
      }).eq("id", dayId);
      if (dayUpdate.error) return await fail(dayUpdate.error.message);

      markSheet(dayId, { checking: false, error: null, checkedAt: Date.now(), last: plan.summary });
      await refetch();
      return { status: "synced", summary: plan.summary, warnings: parsed.warnings };
    } catch (e) {
      return await fail(e.message || "Something went wrong while syncing.");
    } finally {
      busySheets.current.delete(dayId);
    }
  }, [projectId, user, refetch]);

  const linkSheet = useCallback(async (dayId, { sheetId, sheetGid, lengthFormat, map = {}, replaceExisting = false }) => {
    const settings = { sheetId, sheetGid: sheetGid || "0", sheetLengthFormat: lengthFormat, sheetMap: map, sheetHash: null, sheetStart: null, sheetError: null };
    const { error } = await supabase.from("days").update({
      sheet_id: sheetId, sheet_gid: sheetGid || "0", sheet_length_format: lengthFormat, sheet_map: map, sheet_hash: null, sheet_start: null, sheet_error: null,
    }).eq("id", dayId);
    if (error) {
      notify("Couldn't link the sheet", `${error.message}. If it mentions a missing column, run supabase/migrations/004_google_sheet.sql in the Supabase SQL editor once.`);
      return { status: "error" };
    }
    return syncSheet(dayId, { force: true, override: settings, replaceExisting });
  }, [syncSheet]);

  const unlinkSheet = useCallback(async (dayId) => {
    await supabase.from("days").update({ sheet_id: null, sheet_gid: null, sheet_hash: null, sheet_start: null, sheet_error: null, sheet_synced_at: null, sheet_map: {} }).eq("id", dayId);
    await supabase.from("cues").update({ sheet_key: null, sheet_snapshot: null }).eq("day_id", dayId);
    const noteIds = daysRef.current.find((d) => d.id === dayId)?.cues.flatMap((c) => Object.values(c.roleNotes || {}).flat().filter((n) => n.fromSheet).map((n) => n.id)) || [];
    if (noteIds.length) await supabase.from("cue_notes").update({ from_sheet: false }).in("id", noteIds);
    markSheet(dayId, { error: null, checking: false });
    refetch();
  }, [refetch]);

  /* ---- invites ---- */
  const addInvite = useCallback(async (email, positionId, isGuest) => {
    const { data } = await supabase.from("invites").upsert(
      { project_id: projectId, email, position_id: isGuest ? null : positionId, is_guest: !!isGuest },
      { onConflict: "project_id,email" }
    ).select("id").maybeSingle();
    refetch();
    return data?.id || null;
  }, [projectId, refetch]);

  // Asks the server to email the invite (api/send-invite.js). Resolves to { ok } or { ok: false, error, message }.
  const sendInviteEmail = useCallback(async (inviteId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ inviteId }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) return { ok: true };
      return { ok: false, error: body.error || "failed", message: body.message || "The email couldn't be sent." };
    } catch {
      return { ok: false, error: "network", message: "Couldn't reach the server. Check the connection and try again." };
    }
  }, []);

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
    addNote, deleteNote, addInvite, sendInviteEmail, removeInvite, joinProject, updateMyMembership,
    sheetState, syncSheet, linkSheet, unlinkSheet,
  };
}
