// Set at build time from version.json (date + running number for that day, e.g. 2026-11-05.3).
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
