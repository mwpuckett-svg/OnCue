/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        desk: v("desk"),
        paper: v("paper"),
        sunk: v("sunk"),
        ink: v("ink"),
        mute: v("mute"),
        faint: v("faint"),
        rule: v("rule"),
        "rule-strong": v("rule-strong"),
        signal: v("signal"),
        ok: v("ok"),
        hold: v("hold"),
        focus: v("focus"),
      },
      fontFamily: {
        // One family, Hanken Grotesk, in different weights. Self-hosted through @fontsource.
        body: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
        display: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.1rem" }],
        sm: ["0.9375rem", { lineHeight: "1.3rem" }],
        base: ["1rem", { lineHeight: "1.45rem" }],
      },
      borderRadius: { DEFAULT: "2px", sm: "2px", md: "3px", lg: "4px", btn: "8px" },
    },
  },
  plugins: [],
};
