import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const v = JSON.parse(readFileSync(new URL("./version.json", import.meta.url), "utf8"));
const APP_VERSION = `${v.date}.${v.build}`;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "OnCue",
        short_name: "OnCue",
        description: "Run of show for live events.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#E7E8E2",
        theme_color: "#1E2A33",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell only. Live show data always comes from Supabase, never from the cache.
        globPatterns: ["**/*.{js,css,html,woff2,png}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
