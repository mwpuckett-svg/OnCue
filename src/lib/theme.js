export const theme = {
  bg: "#0B0D12",
  panel: "#141822",
  panelAlt: "#1B2030",
  hairline: "#262B3B",
  hairlineLight: "#333A52",
  text: "#F2F0EA",
  textMuted: "#8A90A6",
  textFaint: "#565D75",
  amber: "#FFB23E",
  green: "#34D399",
  gold: "#FBBF24",
  red: "#F2495C",
  blueHold: "#38BDF8",
};

export const CATEGORIES = [
  { key: "doors", label: "Doors", color: theme.red },
  { key: "preshow", label: "Preshow", color: "#A3E635" },
  { key: "segment", label: "Segment", color: theme.green },
  { key: "speaker", label: "Speaker", color: "#A78BFA" },
  { key: "performance", label: "Performance", color: theme.blueHold },
  { key: "break", label: "Break", color: theme.gold },
  { key: "transition", label: "Transition", color: "#94A3B8" },
  { key: "vip", label: "VIP / Special", color: "#FB7185" },
];
export const catOf = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[2];

export const PALETTE = [
  theme.amber, theme.blueHold, theme.gold, "#A78BFA", theme.green,
  "#FB7185", "#94A3B8", "#A3E635", theme.red, "#F472B6", "#60A5FA", "#FACC15",
];

export const GUEST_LABEL = "Guest / Client (view only)";
