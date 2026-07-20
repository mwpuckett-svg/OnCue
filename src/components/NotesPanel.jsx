import React, { useState } from "react";
import { X } from "lucide-react";
import { theme } from "../lib/theme.js";
import { formatNoteTime } from "../lib/scheduleUtils.js";

function NoteThread({ notes, onAdd, onDelete, placeholder }) {
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
        <div className="space-y-1.5 mb-1.5">
          {notes.map((n) => (
            <div key={n.id} className="rounded-md px-2 py-1.5 text-xs flex items-start justify-between gap-2" style={{ background: theme.panelAlt, border: `1px solid ${theme.hairline}` }}>
              <div className="min-w-0">
                <div style={{ color: theme.text }}>{n.text}</div>
                <div className="text-[10px] mt-0.5" style={{ color: theme.textFaint }}>
                  {n.author || "Unnamed"}{n.ts ? ` · ${formatNoteTime(n.ts)}` : ""}
                </div>
              </div>
              <button onClick={() => onDelete(n.id)} className="shrink-0" style={{ color: theme.textFaint }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
          style={{ background: theme.panel, color: theme.text, border: `1px solid ${theme.hairline}` }}
        />
        <button onClick={submit} className="ros-surface-btn rounded-md px-2.5 text-xs font-semibold shrink-0 transition-colors" style={{ border: `1px solid ${theme.hairline}`, color: theme.textMuted }}>Add</button>
      </div>
    </div>
  );
}

export default function NotesPanel({ cue, isAdmin, isGuest, myPosition, positions, authorName, onUpdate, onAddNote, onDeleteNote }) {
  return (
    <div className="mt-2 pt-2.5 pl-3 sm:pl-[104px] pr-1" style={{ borderTop: `1px dashed ${theme.hairline}` }}>
      <div className="mb-2.5">
        <div className="text-[10px] font-semibold tracking-wide uppercase mb-1" style={{ color: theme.textFaint }}>General note</div>
        {isAdmin ? (
          <input
            value={cue.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Visible to everyone — staging, AV cues, context…"
            className="bg-transparent outline-none text-xs w-full pb-1"
            style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.hairline}` }}
          />
        ) : (
          <p className="text-xs" style={{ color: cue.notes ? theme.textMuted : theme.textFaint }}>
            {cue.notes || "No general note from the Stage Manager."}
          </p>
        )}
      </div>

      {isGuest ? null : isAdmin ? (
        <div className="grid sm:grid-cols-2 gap-2.5 pb-1">
          {positions.map((p) => (
            <div key={p.id}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase mb-1" style={{ color: p.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </div>
              <NoteThread
                notes={cue.roleNotes[p.id] || []}
                onAdd={(text) => onAddNote(cue.id, p.id, text)}
                onDelete={(id) => onDeleteNote(id)}
                placeholder={`Add a ${p.label} note…`}
              />
            </div>
          ))}
        </div>
      ) : myPosition ? (
        <div className="pb-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase mb-1" style={{ color: myPosition.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: myPosition.color }} />
            Your notes — {myPosition.label}
          </div>
          <NoteThread
            notes={cue.roleNotes[myPosition.id] || []}
            onAdd={(text) => onAddNote(cue.id, myPosition.id, text)}
            onDelete={(id) => onDeleteNote(id)}
            placeholder="Only your position + the Stage Manager can see this…"
          />
        </div>
      ) : null}
    </div>
  );
}
