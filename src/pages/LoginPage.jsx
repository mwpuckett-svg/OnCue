import React, { useState } from "react";
import { Button } from "../components/ui.jsx";

// A real fragment of a rundown on the right-hand side, so the sign-in page shows the product.
const SAMPLE = [
  ["8:30 AM", "Doors open", "15:00", false],
  ["8:45 AM", "Welcome and housekeeping", "10:00", false],
  ["8:55 AM", "Opening keynote", "45:00", true],
  ["9:40 AM", "Product roadmap", "30:00", false],
  ["10:10 AM", "Break", "10:00", false],
];

export default function LoginPage({ sendCode, verifyCode }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a full email address, like name@company.com."); return; }
    setBusy(true);
    setError("");
    try {
      await sendCode(normalized);
      setStage("code");
    } catch (e) {
      setError(e.message || "The code didn't send. Check the address and try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) { setError("Enter the 6-digit code from your email."); return; }
    setBusy(true);
    setError("");
    try {
      await verifyCode(email.trim().toLowerCase(), code.trim());
    } catch (e) {
      setError(e.message || "That code isn't right or has expired. Check your email, or go back and send a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(24rem,32rem)_1fr]">
      <div className="flex flex-col justify-between bg-paper px-6 py-8 sm:px-12">
        <span className="font-display text-[1.75rem] font-bold leading-none">OnCue</span>

        <form noValidate className="my-12 w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); (stage === "email" ? submitEmail : submitCode)(); }}>
          <h1 className="font-display text-4xl font-semibold leading-10">{stage === "email" ? "Sign in" : "Check your email"}</h1>
          {stage === "email" ? (
            <>
              <p className="mb-6 mt-2 text-mute">We'll email you a six-digit code. There's no password to remember.</p>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <input
                id="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="name@company.com" type="email" autoComplete="email" autoFocus
                aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} className="field-boxed !py-2.5"
              />
              {error && <p id="login-error" role="alert" className="mt-2 text-sm text-signal">{error}</p>}
              <Button variant="primary" size="lg" type="submit" disabled={busy} className="mt-5 w-full">{busy ? "Sending" : "Email me a code"}</Button>
            </>
          ) : (
            <>
              <p className="mb-6 mt-2 text-mute">We sent a code to <strong className="font-semibold text-ink">{email}</strong>. It can take a minute to arrive.</p>
              <label htmlFor="code" className="mb-1 block text-sm font-medium">Six-digit code</label>
              <input
                id="code" value={code} onChange={(e) => { setCode(e.target.value); setError(""); }}
                placeholder="123456" inputMode="numeric" autoComplete="one-time-code" autoFocus
                aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined}
                className="field-boxed num !py-2.5 !text-xl tracking-[0.2em]"
              />
              {error && <p id="login-error" role="alert" className="mt-2 text-sm text-signal">{error}</p>}
              <Button variant="primary" size="lg" type="submit" disabled={busy} className="mt-5 w-full">{busy ? "Checking" : "Sign in"}</Button>
              <button type="button" onClick={() => { setStage("email"); setCode(""); setError(""); }} className="mt-4 text-sm text-mute underline underline-offset-4 hover:text-ink">
                Use a different email
              </button>
            </>
          )}
        </form>

        <p className="text-sm text-mute">Run of show for live events.</p>
      </div>

      <div className="hidden items-center border-l border-rule bg-desk px-12 lg:flex" aria-hidden="true">
        <div className="w-full max-w-2xl border border-rule bg-paper shadow-[0_1px_0_rgb(var(--rule))]">
          <div className="border-b border-rule px-5 py-4">
            <div className="font-display text-3xl font-semibold leading-8">Annual Sales Meeting</div>
            <div className="mt-0.5 text-sm text-mute">Day 1, starts 8:30 AM, ends 10:20 AM</div>
          </div>
          {SAMPLE.map(([t, n, d, live]) => (
            <div key={n} className={`flex items-baseline gap-5 border-b border-rule px-5 py-2.5 last:border-b-0 ${live ? "row-live bg-paper text-ink" : ""}`}>
              <span className="clock num w-20 text-lg">{t}</span>
              <span className="flex-1 text-base font-medium">{n}</span>
              <span className="clock num text-lg text-mute">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
