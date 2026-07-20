import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { theme } from "../lib/theme.js";
import { IconBtn } from "./ui.jsx";

export default function InvitePanel({ invites, positions, onAdd, onRemove, onClose }) {
  const [email, setEmail] = useState("");
  const [positionId, setPositionId] = useState(() => (positions.find((p) => !p.is_admin) || positions[0])?.id || "guest");
  const [error, setError] = useState("");

  const add = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a valid email."); return; }
    const isGuest = positionId === "guest";
    onAdd(normalized, isGuest ? null : positionId, isGuest);
    setEmail("");
    setError("");
  };

  const labelFor = (inv) => {
    if (inv.is_guest) return "Guest / Client";
    return positions.find((p) => p.id === inv.position_id)?.label || "Unknown position";
  };
  const colorFor = (inv) => {
    if (inv.is_guest) return theme.textMuted;
    return positions.find((p) => p.id === inv.position_id)?.color || theme.textFaint;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,13,18,0.9)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto ros-scrollbar" style={{ background: theme.panel, border: `1px solid ${theme.hairlineLight}` }}>
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: theme.textFaint }}><X size={16} /></button>
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.amber }}>
          <UserPlus size={16} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">Team access</span>
        </div>
        <h2 className="font-display font-semibold text-xl sm:text-2xl mb-1" style={{ color: theme.text }}>Invite your team</h2>
        <p className="text-sm mb-5" style={{ color: theme.textMuted }}>
          Add an email and position for each teammate. When they sign in with that email, they land straight in their role — this is now backed by real login, not the honor system.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="teammate@example.com"
            type="email"
            className="flex-1 min-w-[180px] rounded-md px-2.5 py-2 text-sm outline-none"
            style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${error ? theme.red : theme.hairline}` }}
          />
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="rounded-md px-2 py-2 text-sm outline-none"
            style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}
          >
            {positions.map((p) => <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.label}</option>)}
            <option value="guest" style={{ color: "#111" }}>Guest / Client</option>
          </select>
          <button onClick={add} className="ros-primary-btn rounded-md px-3 py-2 text-sm font-semibold" style={{ background: theme.amber, color: "#1A1204" }}>Add</button>
        </div>
        {error && <p className="text-xs -mt-2 mb-3" style={{ color: theme.red }}>{error}</p>}

        {invites.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: theme.textFaint }}>No invites yet — add teammates above.</p>
        ) : (
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: theme.panelAlt, border: `1px solid ${theme.hairline}` }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorFor(inv) }} />
                <span className="text-sm flex-1 truncate" style={{ color: theme.text }}>{inv.email}</span>
                <span className="text-[11px] font-medium shrink-0" style={{ color: colorFor(inv) }}>{labelFor(inv)}</span>
                <IconBtn onClick={() => onRemove(inv.id)} title="Remove invite" style={{ color: theme.textMuted }} danger><X size={13} /></IconBtn>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
