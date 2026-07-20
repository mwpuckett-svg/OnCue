import React, { useState } from "react";
import { Radio, Plus, Trash2, LogOut } from "lucide-react";
import { theme } from "../lib/theme.js";
import { dateChipParts } from "../lib/scheduleUtils.js";
import { IconBtn } from "../components/ui.jsx";

export default function ProjectsPage({ projects, onOpen, onCreate, onDelete, onSignOut, userEmail }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await onCreate(name, date);
      setName("");
      setDate("");
      if (id) onOpen(id);
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...projects].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2" style={{ color: theme.textFaint }}>
          <Radio size={13} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">Run of Show</span>
        </div>
        <button onClick={onSignOut} className="inline-flex items-center gap-1.5 text-xs" style={{ color: theme.textFaint }}>
          <LogOut size={12} /> {userEmail}
        </button>
      </div>
      <h1 className="font-display font-semibold text-2xl sm:text-3xl mb-1" style={{ color: theme.text }}>Your shows</h1>
      <p className="text-sm mb-6" style={{ color: theme.textMuted }}>Pick a show to open its run of show, or start a new one.</p>

      <div className="flex flex-wrap gap-2 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="New show name"
          className="flex-1 min-w-[160px] rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: theme.panel, color: theme.text, border: `1px solid ${theme.hairline}` }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: theme.panel, color: theme.text, border: `1px solid ${theme.hairline}` }}
        />
        <button
          onClick={submit}
          disabled={busy}
          className="ros-primary-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity shrink-0 disabled:opacity-50"
          style={{ background: theme.amber, color: "#1A1204" }}
        >
          <Plus size={15} /> Create show
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ border: `1px dashed ${theme.hairlineLight}` }}>
          <p className="text-sm" style={{ color: theme.textMuted }}>No shows yet — create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpen(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}
              className="ros-surface-btn w-full text-left rounded-xl p-4 flex items-center gap-3 transition-colors cursor-pointer"
              style={{ background: theme.panel, border: `1px solid ${theme.hairline}` }}
            >
              {p.date && dateChipParts(p.date) && (
                <div className="shrink-0 rounded-lg px-2.5 py-1.5 text-center" style={{ background: theme.panelAlt, border: `1px solid ${theme.hairline}` }}>
                  <div className="ros-mono text-[10px] font-bold uppercase" style={{ color: theme.amber }}>{dateChipParts(p.date).month}</div>
                  <div className="ros-mono text-sm font-bold" style={{ color: theme.text }}>{dateChipParts(p.date).day}</div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: theme.text }}>{p.name}</div>
                {p.venue && <div className="text-xs mt-0.5 truncate" style={{ color: theme.textMuted }}>{p.venue}</div>}
                {!p.date && p.updated_at && <div className="text-[10px] mt-1" style={{ color: theme.textFaint }}>Updated {new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>}
              </div>
              <IconBtn onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} title="Delete show" style={{ color: theme.textMuted }} danger>
                <Trash2 size={14} />
              </IconBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
