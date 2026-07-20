import React, { useState } from "react";
import { Radio } from "lucide-react";
import { theme } from "../lib/theme.js";

export default function LoginPage({ sendCode, verifyCode }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("email"); // "email" | "code"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a valid email."); return; }
    setBusy(true);
    setError("");
    try {
      await sendCode(normalized);
      setStage("code");
    } catch (e) {
      setError(e.message || "Couldn't send the code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) { setError("Enter the code from your email."); return; }
    setBusy(true);
    setError("");
    try {
      await verifyCode(email.trim().toLowerCase(), code.trim());
    } catch (e) {
      setError(e.message || "That code didn't work. Check your email and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: theme.bg }}>
      <div className="w-full max-w-sm rounded-2xl p-6 sm:p-8" style={{ background: theme.panel, border: `1px solid ${theme.hairlineLight}` }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.textFaint }}>
          <Radio size={13} />
          <span className="text-[11px] font-semibold tracking-widest uppercase">Run of Show</span>
        </div>
        <h1 className="font-display font-semibold text-2xl mb-1" style={{ color: theme.text }}>Sign in</h1>

        {stage === "email" ? (
          <>
            <p className="text-sm mb-4" style={{ color: theme.textMuted }}>We'll email you a 6-digit code — no password needed.</p>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitEmail()}
              placeholder="you@example.com"
              type="email"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none mb-3"
              style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${error ? theme.red : theme.hairline}` }}
            />
            {error && <p className="text-xs mb-3" style={{ color: theme.red }}>{error}</p>}
            <button
              onClick={submitEmail}
              disabled={busy}
              className="ros-primary-btn w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: theme.amber, color: "#1A1204" }}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: theme.textMuted }}>Enter the code sent to <span style={{ color: theme.text }}>{email}</span>.</p>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="123456"
              inputMode="numeric"
              className="ros-mono w-full rounded-md px-3 py-2.5 text-lg text-center tracking-widest outline-none mb-3"
              style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${error ? theme.red : theme.hairline}` }}
            />
            {error && <p className="text-xs mb-3" style={{ color: theme.red }}>{error}</p>}
            <button
              onClick={submitCode}
              disabled={busy}
              className="ros-primary-btn w-full rounded-lg px-3 py-2.5 text-sm font-semibold mb-3 transition-opacity disabled:opacity-50"
              style={{ background: theme.amber, color: "#1A1204" }}
            >
              {busy ? "Checking…" : "Continue"}
            </button>
            <button onClick={() => { setStage("email"); setCode(""); setError(""); }} className="w-full text-center text-xs" style={{ color: theme.textFaint }}>
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
