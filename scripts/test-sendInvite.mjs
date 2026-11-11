// Tests api/send-invite.js against a pretend Supabase. Run: node scripts/test-sendInvite.mjs
import http from "node:http";
import assert from "node:assert/strict";

const PID = "11111111-1111-4111-8111-111111111111";
const INV = "22222222-2222-4222-8222-222222222222";
const POS = "33333333-3333-4333-8333-333333333333";
const INV_GUEST = "44444444-4444-4444-8444-444444444444";
let admin = true;
const db = http.createServer((req, res) => {
  const ok = (b) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(b)); };
  if (req.headers.authorization !== "Bearer good-token") { res.statusCode = 401; return ok({ message: "bad jwt" }); }
  if (req.url.startsWith("/rest/v1/rpc/is_project_admin")) return ok(admin);
  if (req.url.startsWith(`/rest/v1/invites?id=eq.${INV}`)) return ok([{ id: INV, email: "new@example.com", project_id: PID, position_id: POS, is_guest: false }]);
  if (req.url.startsWith(`/rest/v1/invites?id=eq.${INV_GUEST}`)) return ok([{ id: INV_GUEST, email: "client@example.com", project_id: PID, position_id: null, is_guest: true }]);
  if (req.url.startsWith("/rest/v1/invites")) return ok([]); // not visible
  if (req.url.startsWith("/rest/v1/projects")) return ok([{ name: 'SC <Vizio> "Meeting"', date: "2026-11-10", venue: "Hilton" }]);
  if (req.url.startsWith("/rest/v1/positions")) return ok([{ label: "Audio (A1)" }]);
  res.statusCode = 404; ok({});
});
await new Promise((r) => db.listen(0, "127.0.0.1", r));
process.env.SUPABASE_URL = `http://127.0.0.1:${db.address().port}`;
process.env.SUPABASE_ANON_KEY = "anon";
process.env.INVITE_MAIL_DRY_RUN = "1";
process.env.GMAIL_USER = "sender@gmail.com";
const { default: handler } = await import("../api/send-invite.js");

async function call({ method = "POST", token = "good-token", body = { inviteId: INV } } = {}) {
  const req = { method, headers: { host: "on-cue-chi.vercel.app", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body };
  const out = {};
  const res = { setHeader() {}, end(s) { out.body = JSON.parse(s); } };
  Object.defineProperty(res, "statusCode", { set(v) { out.status = v; }, get() { return out.status; } });
  await handler(req, res);
  return out;
}

let r = await call();
assert.equal(r.status, 200); assert.equal(r.body.ok, true);
const m = r.body.dryRun;
assert.equal(m.to[0].address, "new@example.com");
assert.match(m.subject, /invited to SC <Vizio> "Meeting" on OnCue/);
assert.match(m.text, /as Audio \(A1\)/); assert.match(m.text, /https:\/\/on-cue-chi\.vercel\.app/); assert.match(m.text, /six-digit code/);
assert.ok(m.html.includes("SC &lt;Vizio&gt; &quot;Meeting&quot;"), "show name is HTML-escaped");
assert.equal(m.from.address, "sender@gmail.com");
console.log("ok: admin sends a real invite, show name escaped");

r = await call({ body: { inviteId: INV_GUEST } });
assert.equal(r.status, 200); assert.match(r.body.dryRun.text, /a guest \(view only\)/);
console.log("ok: guest invite wording");

admin = false; r = await call(); assert.equal(r.status, 403); admin = true;
console.log("ok: non-admin refused");
r = await call({ token: "" }); assert.equal(r.status, 401);
r = await call({ token: "bad" }); assert.equal(r.status, 401);
console.log("ok: signed-out / bad token refused");
r = await call({ body: { inviteId: "55555555-5555-4555-8555-555555555555" } }); assert.equal(r.status, 404);
console.log("ok: address not on the invite list is never emailed");
r = await call({ body: { inviteId: "x'; drop" } }); assert.equal(r.status, 400);
r = await call({ method: "GET" }); assert.equal(r.status, 405);
console.log("ok: bad input and wrong method refused");

delete process.env.INVITE_MAIL_DRY_RUN; delete process.env.GMAIL_USER;
r = await call(); assert.equal(r.status, 501); assert.equal(r.body.error, "not-configured");
console.log("ok: reports not-configured when Gmail settings are missing");

db.close();
console.log("sendInvite: all checks passed");
