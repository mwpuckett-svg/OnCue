import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const looksLikePlaceholder =
  !url || !anonKey || url.includes("your-project-ref") || anonKey.includes("your-anon-public-key");

export const supabaseConfigured = !looksLikePlaceholder;

// Only construct the real client when config looks valid — createClient()
// throws immediately on a missing/malformed URL, which otherwise crashes
// the whole app into a blank white screen before React can render anything.
export const supabase = supabaseConfigured
  ? createClient(url, anonKey)
  : null;

if (!supabaseConfigured) {
  console.error(
    "Missing or placeholder Supabase config. Create a .env file (see .env.example) with your real " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server (Ctrl+C, then npm run dev)."
  );
}
