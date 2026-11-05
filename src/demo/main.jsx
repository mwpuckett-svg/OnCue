import React, { useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "../index.css";
import ShowPage from "../pages/ShowPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import ProjectsPage from "../pages/ProjectsPage.jsx";
import { ConfirmHost } from "../components/ui.jsx";
import { todayLocalStr } from "../lib/scheduleUtils.js";
import { PALETTE } from "../lib/theme.js";
import { ask, notify } from "../lib/confirm.js";

const POS = [
  ["Stage Manager", "#C8452B", true], ["Producer", "#2F7FB8", true], ["Production Manager", "#6B5BB5", true],
  ["Audio (A1)", "#C99A1A", false], ["Video", "#2E8B6E", false], ["Lighting", "#BE4B7A", false],
  ["Camera", "#7C9A2D", false], ["Graphics", "#8A9199", false], ["Talent Wrangler", "#D9772B", false],
].map(([label, color, is_admin], i) => ({ id: "p" + i, label, color, is_admin, sort_order: i }));

const C = (name, category, durationSec, owner, extra = {}) => ({ name, category, durationSec, owner, notes: "", locked: false, lockedTime: "", roleNotes: {}, ...extra });
const SEED = [
  C("Doors open", "doors", 900, "Venue", { locked: true, lockedTime: "08:30", notes: "Coffee and registration open in the lobby." }),
  C("Welcome and housekeeping", "segment", 600, "Allison Clark", { roleNotes: { p3: [{ id: "n1", text: "Walk-in music down 6 dB at the welcome.", author: "Jamie", ts: "2026-07-21T15:02:00Z", positionId: "p3" }] } }),
  C("Opening keynote", "speaker", 2700, "Victor Hale", { notes: "Lav on stage left. Clicker is in the podium drawer." }),
  C("Product roadmap", "speaker", 1800, "Heather Ross"),
  C("Break", "break", 600, "", { locked: true, lockedTime: "10:00" }),
  C("Customer panel", "segment", 3600, "William Vance", { roleNotes: { p4: [{ id: "n2", text: "Roll the customer logos behind the panel.", author: "Sam", ts: "2026-07-21T16:10:00Z", positionId: "p4" }] } }),
  C("Transition to lunch", "transition", 300, "Stage Manager"),
  C("Lunch", "break", 5400, "", { locked: true, lockedTime: "12:00" }),
  C("Afternoon workshop", "performance", 3600, "Allison Clark"),
  C("VIP reception walk-through", "vip", 1800, "Executive team"),
  C("Close, highlights and agenda recap", "segment", 1800, "Heather Ross", { locked: true, lockedTime: "17:00" }),
];

function Preview() {
  const [project, setProject] = useState({ id: "x", name: "SC Vizio Meeting", venue: "Hilton Union Square, Grand Ballroom", date: todayLocalStr() });
  const [positions, setPositions] = useState(POS);
  const [invites, setInvites] = useState([
    { id: "i1", email: "sam@avad3.com", position_id: "p4", is_guest: false },
    { id: "i2", email: "client@vizio.com", position_id: null, is_guest: true },
  ]);
  const [days, setDays] = useState(() => [
    { id: "d1", label: "Day 1", date: todayLocalStr(), startTime: "08:30", targetEnd: "17:00", cues: SEED.map((c, i) => ({ ...c, id: "c" + i, sortOrder: i })) },
    { id: "d2", label: "Day 2", date: "", startTime: "09:00", targetEnd: "", cues: [] },
  ]);
  // Helpers that change one day, or whichever day holds a given cue.
  const inDay = (dayId, fn) => setDays((ds) => ds.map((d) => (d.id === dayId ? { ...d, cues: fn(d.cues) } : d)));
  const inAnyDay = (fn) => setDays((ds) => ds.map((d) => ({ ...d, cues: fn(d.cues) })));
  const [role, setRole] = useState(new URLSearchParams(location.search).get("role") || "p0");
  const editingRef = useRef(false);
  const n = useRef(100);
  const data = {
    project, positions,
    days,
    updateShow: (p) => setProject((s) => ({ ...s, ...p })),
    callCue: (dayId, { from = null, to = null, back = false, reset = false } = {}) => {
      const now = Date.now();
      setDays((ds) => ds.map((d) => d.id !== dayId ? d : {
        ...d, liveCueId: to, liveStartedAt: to ? now : null,
        cues: d.cues.map((c) => {
          if (c.id === to) return { ...c, actualStart: now, actualEnd: null };
          if (reset) return { ...c, actualStart: null, actualEnd: null };
          if (c.id === from) return back ? { ...c, actualStart: null, actualEnd: null } : { ...c, actualEnd: now };
          return c;
        }),
      }));
    },
    updateDay: (id, p) => setDays((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d))),
    addDay: () => setDays((ds) => [...ds, { id: "d" + n.current++, label: `Day ${ds.length + 1}`, date: "", startTime: "18:00", targetEnd: "", cues: [] }]),
    deleteDay: (id) => setDays((ds) => (ds.length > 1 ? ds.filter((d) => d.id !== id) : ds)),
    duplicateDay: (id) => setDays((ds) => { const d = ds.find((x) => x.id === id); return [...ds, { ...d, id: "d" + n.current++, label: `${d.label} copy`, cues: d.cues.map((c) => ({ ...c, id: "n" + n.current++ })) }]; }),
    addCue: (dayId, at) => inDay(dayId, (s) => { const c = { ...C("New cue", "segment", 300, ""), id: "n" + n.current++ }; const a = [...s]; a.splice(at, 0, c); return a; }),
    updateCue: (id, p) => inAnyDay((s) => s.map((c) => (c.id === id ? { ...c, ...p } : c))),
    deleteCue: (id) => inAnyDay((s) => s.filter((c) => c.id !== id)),
    duplicateCue: (dayId, id) => inDay(dayId, (s) => { const i = s.findIndex((c) => c.id === id); const a = [...s]; a.splice(i + 1, 0, { ...s[i], id: "n" + n.current++ }); return a; }),
    reorderCues: (dayId, ids) => inDay(dayId, (s) => ids.map((id) => s.find((c) => c.id === id))),
    addNote: (cueId, positionId, text, author) => inAnyDay((s) => s.map((c) => c.id !== cueId ? c : { ...c, roleNotes: { ...c.roleNotes, [positionId]: [...(c.roleNotes[positionId] || []), { id: "m" + n.current++, text, author: author || "Mike", ts: new Date().toISOString(), positionId }] } })),
    deleteNote: (noteId) => inAnyDay((s) => s.map((c) => ({ ...c, roleNotes: Object.fromEntries(Object.entries(c.roleNotes).map(([k, v]) => [k, v.filter((x) => x.id !== noteId)])) }))),
    invites, members: [], loading: false, editingRef,
    myMembership: role === "none" ? null : { position_id: role === "guest" ? null : role, is_guest: role === "guest", display_name: "Mike" },
    addInvite: (email, positionId, isGuest) => setInvites((x) => (x.some((i) => i.email === email) ? x : [...x, { id: "i" + n.current++, email, position_id: positionId, is_guest: isGuest }])),
    removeInvite: (id) => setInvites((x) => x.filter((i) => i.id !== id)),
    addPosition: (label) => setPositions((x) => [...x, { id: "p" + n.current++, label, color: PALETTE[x.length % PALETTE.length], is_admin: false, sort_order: x.length }]),
    renamePosition: (id, label) => setPositions((x) => x.map((p) => (p.id === id ? { ...p, label } : p))),
    recolorPosition: (id) => setPositions((x) => x.map((p) => (p.id === id ? { ...p, color: PALETTE[(PALETTE.indexOf(p.color) + 1) % PALETTE.length] } : p))),
    toggleAdminPosition: (id) => setPositions((x) => {
      const target = x.find((p) => p.id === id);
      if (target.is_admin && x.filter((p) => p.is_admin).length <= 1) { notify("Keep at least one admin", "Make another position an admin first, then remove admin from this one."); return x; }
      return x.map((p) => (p.id === id ? { ...p, is_admin: !p.is_admin } : p));
    }),
    deletePosition: async (id) => {
      const pos = positions.find((p) => p.id === id);
      if (pos.is_admin && positions.filter((p) => p.is_admin).length <= 1) { notify("This is the last admin position", "Make another position an admin before you remove this one."); return; }
      if (await ask({ title: `Remove ${pos.label}?`, body: "Notes written under this position are deleted with it.", confirmLabel: "Remove position", danger: true })) setPositions((x) => x.filter((p) => p.id !== id));
    },
    joinProject: () => {}, updateMyMembership: (v) => setRole(v.isGuest ? "guest" : v.positionId),
  };
  return (
    <>
      <ShowPage data={data} user={{ email: "mike@example.com" }} onGoToProjects={() => { location.search = "?page=projects"; }} />
      <ConfirmHost />
      <label className="no-print fixed bottom-3 left-3 z-40 flex items-center gap-2 border border-rule-strong bg-paper px-2.5 py-1.5 text-xs text-mute">
        Demo data. View as
        <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-transparent text-ink">
          {POS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="guest">Guest</option>
          <option value="none">New joiner (position picker)</option>
        </select>
      </label>
    </>
  );
}
const page = new URLSearchParams(location.search).get("page");
const today = todayLocalStr();
const shows = [
  { id: "a", name: "SC Vizio Meeting", venue: "Hilton Union Square, Grand Ballroom", date: today },
  { id: "b", name: "Fall General Session", venue: "Walton Arts Center", date: "2026-12-03" },
  { id: "c", name: "Leadership Summit", venue: "", date: null, updated_at: "2026-10-01" },
  { id: "d", name: "Spring Kickoff", venue: "Bentonville Convention Center", date: "2026-03-12" },
];
const Root = () => page === "login" ? <LoginPage sendCode={async () => {}} verifyCode={async () => {}} />
  : page === "projects" ? <><ProjectsPage projects={shows} onOpen={() => { location.search = "?role=p0"; }} onCreate={async () => {}} onDelete={() => {}} onSignOut={() => {}} userEmail="mike@example.com" /><ConfirmHost /></>
  : <Preview />;
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
