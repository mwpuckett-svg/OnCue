import React, { useState } from "react";
import { X } from "lucide-react";
import { Button, Drawer, IconBtn } from "./ui.jsx";

export default function InvitePanel({ invites, positions, onAdd, onRemove, onClose }) {
  const [email, setEmail] = useState("");
  const [positionId, setPositionId] = useState(() => (positions.find((p) => !p.is_admin) || positions[0])?.id || "guest");
  const [error, setError] = useState("");

  const add = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a full email address, like name@company.com."); return; }
    const isGuest = positionId === "guest";
    onAdd(normalized, isGuest ? null : positionId, isGuest);
    setEmail("");
    setError("");
  };

  const labelFor = (inv) => (inv.is_guest ? "Guest" : positions.find((p) => p.id === inv.position_id)?.label || "Removed position");
  const colorFor = (inv) => (inv.is_guest ? null : positions.find((p) => p.id === inv.position_id)?.color || null);

  return (
    <Drawer
      title="Invites"
      subtitle="When someone signs in with an invited email, they land in the position you chose."
      onClose={onClose}
    >
      <form noValidate className="mb-6" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">Email</label>
        <input
          id="invite-email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="name@company.com"
          type="email"
          aria-invalid={!!error}
          className="field-boxed"
        />
        {error && <p className="mt-1 text-sm text-signal">{error}</p>}
        <label htmlFor="invite-position" className="mb-1 mt-3 block text-sm font-medium">Position</label>
        <select id="invite-position" value={positionId} onChange={(e) => setPositionId(e.target.value)} className="field-boxed">
          {positions.map((p) => <option key={p.id} value={p.id}>{p.label}{p.is_admin ? " (admin)" : ""}</option>)}
          <option value="guest">Guest (view only)</option>
        </select>
        <Button variant="primary" className="mt-4 w-full" type="submit">Send invite</Button>
      </form>

      <h3 className="mb-1 text-sm font-semibold">Invited ({invites.length})</h3>
      {invites.length === 0 ? (
        <p className="py-3 text-sm text-mute">Nobody yet. Add a teammate above.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: colorFor(inv) || "rgb(var(--faint))" }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{inv.email}</div>
                <div className="text-xs text-mute">{labelFor(inv)}</div>
              </div>
              <IconBtn onClick={() => onRemove(inv.id)} title={`Remove invite for ${inv.email}`} danger><X size={14} /></IconBtn>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
