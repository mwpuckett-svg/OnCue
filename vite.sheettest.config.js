// Test build of the real data hook against an in-memory database. Run: npx vite --config vite.sheettest.config.js --port 5198
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify("test") },
  resolve: { alias: [{ find: /^(\.\.?\/)+lib\/supabase\.js$/, replacement: path.resolve("src/test/fakeSupabase.js") }] },
});
