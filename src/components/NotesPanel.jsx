import React, { useState } from "react";
import { X } from "lucide-react";
import { formatNoteTime } from "../lib/scheduleUtils.js";
import { IconBtn } from "./ui.jsx";

function NoteThread({ notes, onAdd, onDelete, placeholder, label }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };
  return (
    <div>
      {notes.length > 0 && (
        <ul className="mb-2 divide-y divide-rule/70">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="text-sm">{n.text}</p>
                <p className="text-xs text-mute">{n.author || "Unnamed"}{n.ts ? `, ${formatNoteTime(n.ts)}` : ""}</p>
              </div>
              <IconBtn onClick={() => onDelete(n.id)} title="Delete note" danger className="opacity-60 group-hover:opacity-100"><X size={13} /></IconBtn>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          aria-label={label}
          className="field-boxed !py-1.5 text-sm"
        />
        <button type="button" onClick={submit} className="h-[34px] shrink-0 rounded-btn border border-rule-strong px-3 text-sm font-medium transition-colors hover:bg-ink/5">Add</button>
      </div>
    </div>
  );
}

function PositionHeading({ position, children }) {
  return (
    <h4 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: position?.color }} aria-hidden="true" />
      {children}
    </h4>
  );
}

export default function NotesPanel({ cue, isAdmin, isGuest, myPosition, positions, onUpdate, onAddNote, onDeleteNote }) {
  return (
    <div className="mt-2.5 border-t border-rule pb-1 pt-3 min-[1100px]:pl-[3.75rem]">
      <div className="mb-4 max-w-3xl">
        <h4 className="mb-1 text-sm font-semibold">Everyone sees this</h4>
        {isAdmin ? (
          <input
            value={cue.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Staging, AV, context for the whole crew"
            aria-label="General note"
            className="field-boxed text-sm"
          />
        ) : (
          <p className={`text-sm ${cue.notes ? "" : "text-mute"}`}>{cue.notes || "Nothing from the stage manager on this cue."}</p>
        )}
      </div>

      {isGuest ? null : isAdmin ? (
        <div className="grid gap-x-8 gap-y-4 pb-2 md:grid-cols-2 xl:grid-cols-3">
          {positions.map((p) => (
            <div key={p.id}>
              <PositionHeading position={p}>{p.label}</PositionHeading>
              <NoteThread
                notes={cue.roleNotes[p.id] || []}
                onAdd={(text) => onAddNote(cue.id, p.id, text)}
                onDelete={onDeleteNote}
                placeholder={`Note for ${p.label}`}
                label={`Add a note for ${p.label}`}
              />
            </div>
          ))}
        </div>
      ) : myPosition ? (
        <div className="max-w-3xl pb-2">
          <PositionHeading position={myPosition}>Your notes ({myPosition.label})</PositionHeading>
          <NoteThread
            notes={cue.roleNotes[myPosition.id] || []}
            onAdd={(text) => onAddNote(cue.id, myPosition.id, text)}
            onDelete={onDeleteNote}
            placeholder="Visible to you and the admins"
            label="Add a note"
          />
        </div>
      ) : null}
    </div>
  );
}
