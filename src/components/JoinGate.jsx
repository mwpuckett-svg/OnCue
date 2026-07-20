import React, { useState, useMemo } from "react";
import { Users, X } from "lucide-react";
import { theme } from "../lib/theme.js";

export default function JoinGate({ mode, positions, invites, userEmail, currentPositionId, currentIsGuest, currentName, onJoin, onClose }) {
  const [name, setName] = useState(currentName || "");
  const matchedInvite = useMemo(
    () => invites.find((i) => i.email === (userEmail || "").toLowerCase()),
    [invites, userEmail]
  );
  const [showManual, setShowManual] = useState(mode === "switch" || !matchedInvite);

  const matchedLabel = matchedInvite
    ? matchedInvite.is_guest
      ? "Guest / Client"
      : positions.find((p) => p.id === matchedInvite.position_id)?.label || "your invited role"
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,13,18,0.9)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto ros-scrollbar" style={{ background: theme.panel, border: `1px solid ${theme.hairlineLight}` }}>
        {mode === "switch" && (
          <button onClick={onClose} className="absolute top-4 right-4" style={{ color: theme.textFaint }}><X size={16} /></button>
        )}
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.amber }}>
          <Users size={16} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">{mode === "pick" ? "Get set up" : "Switch position"}</span>
        </div>
        <h2 className="font-display font-semibold text-xl sm:text-2xl mb-1" style={{ color: theme.text }}>
          {mode === "pick" ? "Who's calling this show?" : "Pick a different position"}
        </h2>

        {!showManual && matchedInvite ? (
          <>
            <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
              You're invited as <span style={{ color: theme.amber, fontWeight: 600 }}>{matchedLabel}</span>. Add your name and you're in.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-md px-2.5 py-2 text-sm outline-none mb-4"
              style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}
            />
            <button
              onClick={() => onJoin(matchedInvite.is_guest ? null : matchedInvite.position_id, matchedInvite.is_guest, name)}
              className="ros-primary-btn w-full rounded-lg px-3 py-2.5 text-sm font-semibold mb-3 transition-opacity"
              style={{ background: theme.amber, color: "#1A1204" }}
            >
              Continue as {matchedLabel}
            </button>
            <button onClick={() => setShowManual(true)} className="w-full text-center text-xs" style={{ color: theme.textFaint }}>
              Not you? Pick a different position
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
              {mode === "pick" ? "No invite found for your email. Choose your position to see the schedule and notes that matter to you." : "Choose a new position for this show."}
            </p>
            <div className="mb-4">
              <label className="text-[10px] font-semibold tracking-wide uppercase mb-1 block" style={{ color: theme.textFaint }}>Your name (optional, shown on your notes)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jamie"
                className="w-full rounded-md px-2.5 py-2 text-sm outline-none"
                style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {positions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onJoin(p.id, false, name)}
                  className="ros-surface-btn text-left rounded-xl p-3 transition-colors"
                  style={{ background: theme.panelAlt, border: `1px solid ${p.id === currentPositionId ? p.color : theme.hairline}` }}
                >
                  <span className="block w-2 h-2 rounded-full mb-2" style={{ background: p.color }} />
                  <span className="font-semibold text-xs block" style={{ color: theme.text }}>{p.label}</span>
                  {p.is_admin && <span className="block text-[10px] mt-0.5" style={{ color: theme.textFaint }}>Full access + all notes</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => onJoin(null, true, name)}
              className="ros-surface-btn w-full text-center rounded-xl p-2.5 text-xs font-semibold mb-4 transition-colors"
              style={{ background: "transparent", border: `1px dashed ${theme.hairline}`, color: theme.textMuted }}
            >
              Continue as Guest / Client (view only)
            </button>
            <p className="text-[11px] leading-relaxed" style={{ color: theme.textFaint }}>
              Your identity is verified by your login now — but picking a position without a matching invite is still self-reported. Only invited emails are pre-assigned to Admin positions automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
