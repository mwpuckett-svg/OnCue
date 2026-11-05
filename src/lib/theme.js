// Category markers are small squares, so they stay mid-tone and read on both themes.
export const CATEGORIES = [
  { key: "doors", label: "Doors", color: "#C8452B" },
  { key: "preshow", label: "Preshow", color: "#7C9A2D" },
  { key: "segment", label: "Segment", color: "#2E8B6E" },
  { key: "speaker", label: "Speaker", color: "#6B5BB5" },
  { key: "performance", label: "Performance", color: "#2F7FB8" },
  { key: "break", label: "Break", color: "#C99A1A" },
  { key: "transition", label: "Transition", color: "#8A9199" },
  { key: "vip", label: "VIP / Special", color: "#BE4B7A" },
];
export const catOf = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[2];

// Swatches offered when recoloring a crew position.
export const PALETTE = [
  "#C8452B", "#C99A1A", "#7C9A2D", "#2E8B6E", "#2F7FB8", "#6B5BB5",
  "#BE4B7A", "#8A9199", "#D9772B", "#3E9AA8", "#4F6FD0", "#9A6B3F",
];

export const GUEST_LABEL = "Guest / client (view only)";

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "booth" ? "booth" : "desk";
}
export function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("oncue-theme", t); } catch (e) { /* storage can be blocked */ }
}

