import React from "react";
import { Plus } from "lucide-react";
import { formatDateShort, todayLocalStr } from "../lib/scheduleUtils.js";

export default function DayTabs({ days, activeDayId, onSelect, isAdmin, onAdd }) {
  const today = todayLocalStr();
  return (
    <div role="tablist" aria-label="Show days" className="scroll-thin flex items-end gap-6 overflow-x-auto">
      {days.map((d) => {
        const active = d.id === activeDayId;
        return (
          <button
            key={d.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(d.id)}
            className={`-mb-px shrink-0 border-b-2 pb-2 pt-1 text-left transition-colors ${
              active ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"
            }`}
          >
            <span className="block font-display text-xl font-semibold leading-6">{d.label}</span>
            <span className="block text-xs">
              {d.date ? formatDateShort(d.date) : "No date"}
              {d.date === today ? ", today" : ""}
            </span>
          </button>
        );
      })}
      {isAdmin && (
        <button
          onClick={onAdd}
          className="-mb-px inline-flex shrink-0 items-center gap-1 border-b-2 border-transparent pb-2 pt-1 text-sm text-mute transition-colors hover:text-ink"
        >
          <Plus size={14} /> Add day
        </button>
      )}
    </div>
  );
}
