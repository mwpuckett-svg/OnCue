import React, { useState } from "react";
import { X, Mail, Copy, Check } from "lucide-react";
import { Button, Drawer, IconBtn } from "./ui.jsx";

function inviteMessage({ showName, role, appUrl, email }) {
  const subject = `You're invited to ${showName || "our show"} on OnCue`;
  const body = [
    "Hi,",
    "",
    `You've been added to ${showName || "the show"} on OnCue as ${role}.`,
    "",
    `1. Open ${appUrl}`,
    `2. Sign in with this email address (${email}). OnCue emails you a six-digit code.`,
    "3. You'll land in the show automatically.",
    "",
    "See you at the show.",
  ].join("\n");
  return { subject, body };
}

export default function InvitePanel({ invites, positions, showName, onAdd, onRemove, onClose }) {
  const [copiedId, setCopiedId] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const [email, setEmail] = useState("");
  const [positionId, setPositionId] = useState(() => (positions.find((p) => !p.is_admin) || positions[0])?.id || "guest");
  const [error, setError] = useState("");

  const add = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a full email address, like name@company.com."); return; }
    const isGuest = positionId === "guest";
    onAdd(normalized, isGuest ? null : positionId, isGuest);
    setLastAdded(normalized);
    setEmail("");
    setError("");
  };

  const messageFor = (inv) =>
    inviteMessage({ showName, role: inv.is_guest ? "a guest (view only)" : labelFor(inv), appUrl, email: inv.email });
  const mailtoFor = (inv) => {
    const { subject, body } = messageFor(inv);
    return `mailto:${encodeURIComponent(inv.email).replace("%40", "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const copyFor = async (inv) => {
    const { subject, body } = messageFor(inv);
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); } catch { /* clipboard blocked */ }
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId((id) => (id === inv.id ? null : id)), 2000);
  };

  const labelFor = (inv) => (inv.is_guest ? "Guest" : positions.find((p) => p.id === inv.position_id)?.label || "Removed position");
  const colorFor = (inv) => (inv.is_guest ? null : positions.find((p) => p.id === inv.position_id)?.color || null);

  return (
    <Drawer
      title="Invites"
      subtitle="Add a teammate, then email them the invite. When they sign in with that address they land in the position you chose."
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
        <Button variant="primary" className="mt-4 w-full" type="submit">Add invite</Button>
      </form>

      <h3 className="mb-1 text-sm font-semibold">Invited ({invites.length})</h3>
      {invites.length === 0 ? (
        <p className="py-3 text-sm text-mute">Nobody yet. Add a teammate above.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {invites.map((inv) => (
            <li key={inv.id} className={`flex items-center gap-2 py-2 ${lastAdded === inv.email ? "bg-ink/[0.04]" : ""}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: colorFor(inv) || "rgb(var(--faint))" }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{inv.email}</div>
                <div className="text-xs text-mute">{labelFor(inv)}</div>
              </div>
              <a
                href={mailtoFor(inv)}
                title={`Email invite to ${inv.email}`}
                aria-label={`Email invite to ${inv.email}`}
                className="inline-flex h-7 items-center gap-1 rounded-btn px-2 text-xs font-medium text-ink hover:bg-ink/10"
              >
                <Mail size={13} /> Email
              </a>
              <IconBtn onClick={() => copyFor(inv)} title={`Copy invite message for ${inv.email}`}>
                {copiedId === inv.id ? <Check size={14} /> : <Copy size={14} />}
              </IconBtn>
              <IconBtn onClick={() => onRemove(inv.id)} title={`Remove invite for ${inv.email}`} danger><X size={14} /></IconBtn>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
