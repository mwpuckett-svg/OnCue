export const pad2 = (n) => String(n).padStart(2, "0");

export function clockLabel(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(min)} ${ampm}`;
}

export function timeStrToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTimeStr(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function mmssToSeconds(str) {
  if (str === "" || str == null) return null;
  const parts = String(str).split(":").map((s) => parseInt(s, 10));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function secondsToMMSS(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

export function secondsToRuntimeLabel(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${pad2(m)}m`;
  return `${m}m`;
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}

export function dateChipParts(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return null;
    return { month: d.toLocaleDateString(undefined, { month: "short" }), day: d.getDate() };
  } catch (e) {
    return null;
  }
}

export function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatNoteTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// cues: array of { id, name, category, durationSec, owner, notes, locked, lockedTime, ... }
// day: { startTime, targetEnd }
export function computeSchedule(day, cues) {
  const startMin = timeStrToMinutes(day.startTime);
  let curSec = startMin * 60;
  const rows = (cues || []).map((cue) => {
    const durSec = cue.durationSec || 0;
    let startSec, status = null, driftSec = 0;
    if (cue.locked && cue.lockedTime) {
      const lockedSec = timeStrToMinutes(cue.lockedTime) * 60;
      driftSec = curSec - lockedSec;
      startSec = lockedSec;
      if (driftSec > 30) status = "behind";
      else if (driftSec < -30) status = "hold";
      else status = "on-time";
    } else {
      startSec = curSec;
    }
    const endSec = startSec + durSec;
    curSec = endSec;
    return { ...cue, startSec, endSec, status, driftSec };
  });
  const totalSec = curSec - startMin * 60;
  const endSec = curSec;
  let variance = null;
  if (day.targetEnd) variance = endSec - timeStrToMinutes(day.targetEnd) * 60;
  return { rows, totalSec, endSec, variance, startSec: startMin * 60 };
}
