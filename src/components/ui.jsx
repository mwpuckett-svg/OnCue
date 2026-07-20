import React, { useState } from "react";
import { Check, Clock, AlertTriangle, Plus } from "lucide-react";
import { theme } from "../lib/theme.js";

export function IconBtn({ children, onClick, title, style, disabled, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        ...style,
        background: hover ? (danger ? "rgba(242,73,92,0.14)" : "rgba(255,255,255,0.08)") : "transparent",
        color: hover && danger ? theme.red : style && style.color,
      }}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status, driftSec }) {
  if (!status) return null;
  const mins = Math.round(Math.abs(driftSec) / 60);
  if (status === "on-time")
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.green }}><Check size={11} /> On time</span>;
  if (status === "hold")
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.blueHold }}><Clock size={11} /> Hold {mins}m</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.red }}><AlertTriangle size={11} /> {mins}m behind</span>;
}

export function LoadingBlock({ text }) {
  return <div className="flex items-center justify-center py-24 text-sm" style={{ color: theme.textMuted }}>{text}</div>;
}

export function InsertDivider({ onInsert }) {
  return (
    <div className="ros-insert relative h-3 flex items-center justify-center">
      <div className="ros-insert-line h-px w-full transition-opacity" style={{ background: theme.hairlineLight, opacity: 0 }} />
      <button
        type="button"
        onClick={onInsert}
        title="Insert cue here"
        className="ros-insert-btn absolute rounded-full p-0.5 transition-opacity"
        style={{ background: theme.panelAlt, border: `1px solid ${theme.hairlineLight}`, color: theme.textMuted, opacity: 0.3 }}
      >
        <Plus size={11} />
      </button>
    </div>
  );
}
