import { useState, useEffect, useCallback, useRef } from "react";
import { APP_VERSION } from "../lib/version.js";

const CHECK_EVERY_MS = 60 * 1000;

/** Versions look like 2026-11-10.2: the date, then a running number for that day. */
const parts = (v) => { const [d, n] = String(v).split("."); return [d, parseInt(n, 10) || 0]; };
export function compareVersions(a, b) {
  const [da, na] = parts(a); const [db, nb] = parts(b);
  return da === db ? na - nb : da < db ? -1 : 1;
}

/** What's published next to the app ({ version, changelog }), or null if it can't be read (offline, dev server). */
async function fetchLatest() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const body = await r.json();
    return typeof body.version === "string" ? body : null;
  } catch {
    return null;
  }
}

/**
 * Tells the app whether a newer version of OnCue has been published.
 * Checks when the app opens, about once a minute, and whenever the window comes back into view.
 */
export function useAppUpdate() {
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return null;
    busy.current = true;
    setChecking(true);
    const body = await fetchLatest();
    busy.current = false;
    setChecking(false);
    if (body) setInfo(body);
    return body?.version || null;
  }, []);

  useEffect(() => {
    check();
    const iv = setInterval(() => { if (document.visibilityState === "visible") check(); }, CHECK_EVERY_MS);
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", check);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("online", check); };
  }, [check]);

  const latest = info?.version || null;
  const available = APP_VERSION !== "dev" && !!latest && compareVersions(latest, APP_VERSION) > 0;
  // Change notes for every version newer than this one, newest first.
  const notes = available
    ? (info.changelog || []).filter((e) => compareVersions(e.version, APP_VERSION) > 0 && compareVersions(e.version, latest) <= 0).sort((a, b) => compareVersions(b.version, a.version))
    : [];

  /** Drops the cached copy of the app and reloads so the newest version is fetched. */
  const install = useCallback(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* reload anyway */ }
    window.location.reload();
  }, []);

  return { current: APP_VERSION, latest, available, notes, checking, check, install };
}
