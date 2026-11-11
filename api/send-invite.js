// Emails an OnCue invite. Runs on Vercel.
// POST /api/send-invite  { inviteId }   Authorization: Bearer <the signed-in person's Supabase token>
//   -> { ok: true } or { error, message }
//
// Safety: the person's own token is used for every database read, so Supabase's row-level security decides what they
// can see. Only a show admin passes, and only an address that is already on that show's invite list is ever emailed.
// The message is built here from the database (never from text sent by the browser), so this can't be used to send
// arbitrary email.
//
// Setup (Vercel > Project > Settings > Environment Variables):
//   GMAIL_USER          the Gmail address that sends the invites
//   GMAIL_APP_PASSWORD  a Google "app password" for that address (16 characters, spaces are fine)
// Optional: INVITE_FROM_NAME (default "OnCue"), APP_URL (default: the address the request came to).

import nodemailer from "nodemailer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 10_000) throw new Error("too-big"); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function buildMessage({ showName, role, appUrl, email, date, venue }) {
  const subject = `You're invited to ${showName} on OnCue`;
  const when = [date, venue].filter(Boolean).join(" · ");
  const text = [
    "Hi,",
    "",
    `You've been added to ${showName} on OnCue as ${role}.${when ? `\n${when}` : ""}`,
    "",
    `1. Open ${appUrl}`,
    `2. Sign in with this email address (${email}). OnCue emails you a six-digit code.`,
    "3. You'll land in the show automatically.",
    "",
    "See you at the show.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1c2a33;max-width:520px">
<p>Hi,</p>
<p>You've been added to <strong>${esc(showName)}</strong> on OnCue as <strong>${esc(role)}</strong>.${when ? `<br><span style="color:#5b6870">${esc(when)}</span>` : ""}</p>
<ol style="padding-left:20px"><li>Open <a href="${esc(appUrl)}">${esc(appUrl)}</a></li>
<li>Sign in with this email address (${esc(email)}). OnCue emails you a six-digit code.</li>
<li>You'll land in the show automatically.</li></ol>
<p>See you at the show.</p></div>`;
  return { subject, text, html };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method", message: "Use POST." });

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const dryRun = process.env.INVITE_MAIL_DRY_RUN === "1";
  if (!dryRun && (!gmailUser || !gmailPass)) {
    return send(res, 501, { error: "not-configured", message: "Automatic email isn't set up yet. Use your own mail for now." });
  }

  const supaUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supaUrl || !anon) return send(res, 500, { error: "server", message: "The server is missing its database settings." });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return send(res, 401, { error: "signed-out", message: "Sign in again, then retry." });

  let body;
  try { body = await readJson(req); } catch { return send(res, 413, { error: "too-big", message: "Request too large." }); }
  const inviteId = String(body.inviteId || "");
  if (!UUID_RE.test(inviteId)) return send(res, 400, { error: "bad-request", message: "Missing invite." });

  const headers = { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const get = async (path) => {
    const r = await fetch(`${supaUrl}/rest/v1/${path}`, { headers });
    if (r.status === 401) throw Object.assign(new Error("signed-out"), { code: "signed-out" });
    if (!r.ok) throw new Error(`db-${r.status}`);
    return r.json();
  };

  try {
    const [invite] = await get(`invites?id=eq.${inviteId}&select=id,email,project_id,position_id,is_guest`);
    if (!invite) return send(res, 404, { error: "not-found", message: "That invite wasn't found, or you don't have access to it." });

    const adminRes = await fetch(`${supaUrl}/rest/v1/rpc/is_project_admin`, { method: "POST", headers, body: JSON.stringify({ pid: invite.project_id }) });
    if (adminRes.status === 401) return send(res, 401, { error: "signed-out", message: "Sign in again, then retry." });
    if (!adminRes.ok || (await adminRes.json()) !== true) return send(res, 403, { error: "not-admin", message: "Only show admins can send invites." });

    const [project] = await get(`projects?id=eq.${invite.project_id}&select=name,date,venue`);
    let role = "a guest (view only)";
    if (!invite.is_guest && invite.position_id) {
      const [pos] = await get(`positions?id=eq.${invite.position_id}&select=label`);
      if (pos?.label) role = pos.label;
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const appUrl = (process.env.APP_URL || (host ? `https://${host}` : "")).replace(/\/$/, "");
    const msg = buildMessage({
      showName: project?.name || "the show", role, appUrl, email: invite.email,
      date: project?.date || "", venue: project?.venue || "",
    });

    const transport = dryRun
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmailUser, pass: gmailPass } });
    const info = await transport.sendMail({
      from: `"${(process.env.INVITE_FROM_NAME || "OnCue").replace(/["\r\n]/g, "")}" <${gmailUser || "oncue@example.com"}>`,
      to: invite.email,
      subject: msg.subject, text: msg.text, html: msg.html,
    });
    return send(res, 200, { ok: true, ...(dryRun ? { dryRun: JSON.parse(info.message) } : {}) });
  } catch (e) {
    if (e?.code === "signed-out") return send(res, 401, { error: "signed-out", message: "Sign in again, then retry." });
    if (e?.code === "EAUTH") return send(res, 502, { error: "mail-auth", message: "Gmail rejected the login. Check GMAIL_USER and the app password in Vercel." });
    return send(res, 502, { error: "send-failed", message: "The email couldn't be sent. Try again in a moment." });
  }
}
