import React from "react";
import { Plus } from "lucide-react";
import { theme } from "../lib/theme.js";
import { formatDateShort, todayLocalStr } from "../lib/scheduleUtils.js";

export default function DayTabs({ days, activeDayId, onSelect, isAdmin, onAdd }) {
  const today = todayLocalStr();
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto ros-scrollbar pb-0.5">
      {days.map((d) => {
        const active = d.id === activeDayId;
        return (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className="shrink-0 rounded-t-lg px-3.5 py-2 text-left transition-colors"
            style={{
              background: active ? theme.panelAlt : "transparent",
              border: `1px solid ${active ? theme.hairlineLight : "transparent"}`,
              borderBottom: active ? `1px solid ${theme.panelAlt}` : "1px solid transparent",
            }}
          >
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: active ? theme.text : theme.textFaint }}>
              {d.label}
              {d.date === today && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${theme.green}22`, color: theme.green }}>TODAY</span>}
            </div>
            {d.date && <div className="text-[10px]" style={{ color: theme.textFaint }}>{formatDateShort(d.date)}</div>}
          </button>
        );
      })}
      {isAdmin && (
        <button onClick={onAdd} title="Add day" className="ros-surface-btn shrink-0 rounded-t-lg px-2.5 py-2" style={{ color: theme.textFaint, border: `1px solid ${theme.hairline}` }}>
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
