import React, { useState } from "react";
import { X, Settings2, Trash2 } from "lucide-react";
import { theme } from "../lib/theme.js";
import { IconBtn } from "./ui.jsx";

export default function PositionsPanel({ positions, onAdd, onRename, onRecolor, onToggleAdmin, onDelete, onClose }) {
  const [newLabel, setNewLabel] = useState("");
  const add = () => {
    const t = newLabel.trim();
    if (!t) return;
    onAdd(t);
    setNewLabel("");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,13,18,0.9)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto ros-scrollbar" style={{ background: theme.panel, border: `1px solid ${theme.hairlineLight}` }}>
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: theme.textFaint }}><X size={16} /></button>
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.amber }}>
          <Settings2 size={16} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">Crew setup</span>
        </div>
        <h2 className="font-display font-semibold text-xl sm:text-2xl mb-1" style={{ color: theme.text }}>Customize positions</h2>
        <p className="text-sm mb-5" style={{ color: theme.textMuted }}>
          Rename any position, tap the dot to recolor it, or add new ones. Tap Admin to grant (or remove) full schedule access and all-notes visibility — at least one position has to stay Admin.
        </p>

        <div className="space-y-1.5 mb-4">
          {positions.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: theme.panelAlt, border: `1px solid ${theme.hairline}` }}>
              <button onClick={() => onRecolor(p.id)} title="Change color" className="w-4 h-4 rounded-full shrink-0" style={{ background: p.color }} />
              <input
                value={p.label}
                onChange={(e) => onRename(p.id, e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                style={{ color: theme.text }}
              />
              <button
                onClick={() => onToggleAdmin(p.id)}
                title={p.is_admin ? "Full schedule access + all notes — tap to remove" : "View-only for the schedule — tap to grant full access"}
                className="text-[10px] font-semibold rounded-full px-2 py-1 shrink-0 transition-colors"
                style={{ color: p.is_admin ? theme.amber : theme.textFaint, border: `1px solid ${p.is_admin ? theme.amber : theme.hairline}`, background: p.is_admin ? `${theme.amber}18` : "transparent" }}
              >
                {p.is_admin ? "Admin" : "Make admin"}
              </button>
              <IconBtn onClick={() => onDelete(p.id)} title="Remove position" style={{ color: theme.textMuted }} danger><Trash2 size={13} /></IconBtn>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New position name"
            className="flex-1 rounded-md px-2.5 py-2 text-sm outline-none"
            style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}
          />
          <button onClick={add} className="ros-primary-btn rounded-md px-3 py-2 text-sm font-semibold shrink-0" style={{ background: theme.amber, color: "#1A1204" }}>Add</button>
        </div>
      </div>
    </div>
  );
}
