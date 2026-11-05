import React, { useState, useMemo } from "react";
import { Button, Dialog } from "./ui.jsx";

export default function JoinGate({ mode, positions, invites, userEmail, currentPositionId, currentIsGuest, currentName, onJoin, onClose }) {
  const [name, setName] = useState(currentName || "");
  const matchedInvite = useMemo(() => invites.find((i) => i.email === (userEmail || "").toLowerCase()), [invites, userEmail]);
  const [showManual, setShowManual] = useState(mode === "switch" || !matchedInvite);

  const matchedLabel = matchedInvite
    ? matchedInvite.is_guest ? "Guest" : positions.find((p) => p.id === matchedInvite.position_id)?.label || "your invited position"
    : null;

  const picking = mode === "pick";

  return (
    <Dialog
      title={picking ? "Who are you on this show?" : "Change your position"}
      subtitle={picking ? "You'll see the schedule and the notes that belong to your job." : undefined}
      onClose={onClose}
      dismissable={!picking}
      width="max-w-lg"
    >
      <div className="mb-4">
        <label htmlFor="join-name" className="mb-1 block text-sm font-medium">Your name <span className="font-normal text-mute">(shown on your notes)</span></label>
        <input id="join-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" className="field-boxed" autoComplete="name" />
      </div>

      {!showManual && matchedInvite ? (
        <>
          <p className="mb-3 text-sm text-mute">You were invited as <strong className="font-semibold text-ink">{matchedLabel}</strong>.</p>
          <Button variant="primary" size="lg" className="w-full" onClick={() => onJoin(matchedInvite.is_guest ? null : matchedInvite.position_id, matchedInvite.is_guest, name)}>
            Join as {matchedLabel}
          </Button>
          <button type="button" onClick={() => setShowManual(true)} className="mt-3 w-full text-center text-sm text-mute underline underline-offset-4 hover:text-ink">
            Choose a different position
          </button>
        </>
      ) : (
        <>
          {picking && <p className="mb-2 text-sm text-mute">No invite was found for {userEmail}. Pick your position below.</p>}
          <ul className="divide-y divide-rule border-y border-rule">
            {positions.map((p) => {
              const current = !currentIsGuest && p.id === currentPositionId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onJoin(p.id, false, name)}
                    aria-current={current ? "true" : undefined}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-ink/5"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />
                    <span className="flex-1 text-base font-medium">{p.label}</span>
                    {p.is_admin && <span className="text-xs text-mute">Edits schedule, sees all notes</span>}
                    {current && <span className="text-xs font-semibold">Current</span>}
                  </button>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => onJoin(null, true, name)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-ink/5">
                <span className="h-3 w-3 shrink-0 rounded-[2px] border border-rule-strong" aria-hidden="true" />
                <span className="flex-1 text-base font-medium">Guest or client</span>
                <span className="text-xs text-mute">View only</span>
              </button>
            </li>
          </ul>
          <p className="mt-3 text-xs text-mute">Your login proves who you are. Choosing a position without an invite is on the honor system. Only invited emails are placed in admin positions automatically.</p>
        </>
      )}
    </Dialog>
  );
}
