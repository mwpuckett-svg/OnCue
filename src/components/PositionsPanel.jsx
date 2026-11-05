import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Drawer, IconBtn } from "./ui.jsx";

export default function PositionsPanel({ positions, onAdd, onRename, onRecolor, onToggleAdmin, onDelete, onClose }) {
  const [newLabel, setNewLabel] = useState("");
  const add = () => {
    const t = newLabel.trim();
    if (!t) return;
    onAdd(t);
    setNewLabel("");
  };
  return (
    <Drawer
      title="Crew positions"
      subtitle="Rename positions, change their color, or add your own. Admins can edit the schedule and see every note."
      onClose={onClose}
      footer={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New position name" aria-label="New position name" className="field-boxed" />
          <Button variant="primary" type="submit" className="shrink-0">Add</Button>
        </form>
      }
    >
      <ul className="divide-y divide-rule border-y border-rule">
        {positions.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => onRecolor(p.id)}
              title="Next color"
              aria-label={`Change color for ${p.label}`}
              className="h-5 w-5 shrink-0 rounded-[6px] border border-ink/20"
              style={{ background: p.color }}
            />
            <input value={p.label} onChange={(e) => onRename(p.id, e.target.value)} aria-label="Position name" className="field flex-1 text-sm" />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-mute">
              <input type="checkbox" checked={!!p.is_admin} onChange={() => onToggleAdmin(p.id)} className="h-4 w-4 accent-[rgb(var(--ink))]" />
              Admin
            </label>
            <IconBtn onClick={() => onDelete(p.id)} title={`Remove ${p.label}`} danger><Trash2 size={14} /></IconBtn>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
