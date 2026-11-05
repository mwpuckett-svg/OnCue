import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Sun, Moon } from "lucide-react";
import { getTheme, setTheme } from "../lib/theme.js";
import { registerConfirm } from "../lib/confirm.js";
import { clockLabel, timeStrToMinutes, parseTimeInput } from "../lib/scheduleUtils.js";

/* ---------- Buttons ---------- */

const BTN_BASE = "inline-flex items-center justify-center gap-1.5 font-medium rounded-btn transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

export function Button({ variant = "quiet", size = "md", className = "", children, ...rest }) {
  const sizes = { sm: "h-7 px-2.5 text-xs", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-base" };
  const variants = {
    primary: "bg-ink text-paper hover:bg-ink/85",
    outline: "border border-rule-strong text-ink hover:bg-ink/5",
    quiet: "text-mute hover:text-ink hover:bg-ink/5",
    danger: "text-signal hover:bg-signal/10",
  };
  return (
    <button type="button" className={`${BTN_BASE} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick, title, disabled, danger, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-btn text-mute transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
        danger ? "hover:bg-signal/10 hover:text-signal" : "hover:bg-ink/10 hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Time field: type "8:30a", "830" or "17:00"; shows "8:30 AM" ---------- */

export function TimeField({ value, onChange, label, className = "", placeholder = "Set time" }) {
  const show = (v) => (v ? clockLabel(timeStrToMinutes(v)) : "");
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);
  const commit = () => {
    if (text.trim() === "") { onChange(""); return; }
    const parsed = parseTimeInput(text);
    if (parsed) onChange(parsed);
    else setText(show(value));
  };
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setText(show(value)); e.currentTarget.blur(); } }}
      aria-label={label}
      placeholder={placeholder}
      inputMode="text"
      autoComplete="off"
      className={className}
    />
  );
}

/* ---------- Theme toggle: desk (light) and booth (dark) ---------- */

export function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);
  const booth = theme === "booth";
  const flip = () => {
    const next = booth ? "desk" : "booth";
    setTheme(next);
    setThemeState(next);
  };
  return (
    <Button variant="quiet" size="sm" onClick={flip} title={booth ? "Switch to the light desk theme" : "Switch to the dark booth theme"}>
      {booth ? <Sun size={14} /> : <Moon size={14} />}
      {booth ? "Desk" : "Booth"}
    </Button>
  );
}

/* ---------- Status ---------- */

export function StatusText({ status, driftSec }) {
  if (!status) return null;
  const mins = Math.max(1, Math.round(Math.abs(driftSec) / 60));
  if (status === "on-time") return <span className="text-xs text-ok">On time</span>;
  if (status === "hold") return <span className="text-xs text-hold">Holds {mins} min</span>;
  return <span className="text-xs font-semibold text-signal">{mins} min behind</span>;
}

export function LoadingBlock({ text }) {
  return (
    <div className="flex items-center justify-center py-32 text-sm text-mute" role="status">{text}</div>
  );
}

/* ---------- Insert between rows ---------- */

export function InsertSlot({ onInsert, label = "Insert cue here" }) {
  return (
    <div className="insert-slot no-print relative z-10 h-0">
      <div className="insert-btn absolute inset-x-0 -top-px flex items-center transition-opacity">
        <div className="h-px flex-1 bg-focus/70" />
        <button
          type="button"
          onClick={onInsert}
          title={label}
          aria-label={label}
          className="mx-2 inline-flex h-5 items-center gap-1 rounded-btn bg-focus px-1.5 text-[12px] font-medium text-paper"
        >
          <Plus size={12} strokeWidth={2.5} /> Insert
        </button>
        <div className="h-px flex-1 bg-focus/70" />
      </div>
    </div>
  );
}

/* ---------- Drawer and dialog shells ---------- */

function useEscape(onClose) {
  useEffect(() => {
    if (!onClose) return undefined;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function Drawer({ title, subtitle, onClose, children, footer }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="scrim absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer relative flex h-full w-full max-w-[26rem] flex-col border-l border-rule-strong bg-paper text-ink shadow-[-12px_0_32px_-24px_rgb(0_0_0/0.5)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 pb-3 pt-4">
          <div>
            <h2 className="font-display text-2xl font-semibold leading-7">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
          </div>
          <IconBtn onClick={onClose} title="Close"><X size={16} /></IconBtn>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-rule px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Dialog({ title, subtitle, onClose, children, width = "max-w-md", dismissable = true }) {
  useEscape(dismissable ? onClose : null);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="scrim fixed inset-0 bg-ink/50" onClick={dismissable ? onClose : undefined} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className={`drawer relative w-full ${width} border border-rule-strong bg-paper text-ink`}>
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 pb-3 pt-4">
          <div>
            <h2 className="font-display text-2xl font-semibold leading-7">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
          </div>
          {dismissable && <IconBtn onClick={onClose} title="Close"><X size={16} /></IconBtn>}
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Confirm host (used through lib/confirm.js) ---------- */

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const resolver = useRef(null);
  useEffect(() => {
    registerConfirm((opts) => new Promise((resolve) => { resolver.current = resolve; setReq(opts); }));
    return () => registerConfirm(null);
  }, []);
  const done = (v) => { setReq(null); if (resolver.current) resolver.current(v); resolver.current = null; };
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => done(false)} width="max-w-sm">
      {req.body && <p className="mb-5 text-sm text-mute">{req.body}</p>}
      <div className="flex justify-end gap-2">
        {!req.hideCancel && <Button variant="outline" onClick={() => done(false)}>Cancel</Button>}
        <Button variant={req.danger ? "danger" : "primary"} className={req.danger ? "border border-signal" : ""} onClick={() => done(true)} autoFocus>
          {req.confirmLabel || "Confirm"}
        </Button>
      </div>
    </Dialog>
  );
}

export function SectionLabel({ children, className = "" }) {
  return <h3 className={`text-sm font-semibold text-ink ${className}`}>{children}</h3>;
}
