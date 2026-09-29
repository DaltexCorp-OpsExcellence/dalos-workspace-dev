// DalOS Analytics — access-request / access-change notification emails (Resend).
// DEPLOYED SLUG IS "Send-access-request" (capital S) — all 12 Analytics callers use it.
// Deploy ONLY with that exact slug; `deploy send-access-request` would create a 2nd function.
//
// Hardened 2026-09-29 (was an open relay: verify_jwt=false, no auth, caller-chosen
// recipient, unescaped HTML → anyone could send phishing from noreply@daltexcorp.com):
//  - deploy with verify_jwt=true AND in-code getUser(): a signed-in DalOS user is required
//    (Analytics pages already send the JWT — gate.js stamps it on every Supabase call).
//  - "request": always to ADMIN_EMAIL; requester email comes from the JWT, never the body.
//  - "approval"/"update"/"revoke"/"decline": caller must be is_admin() (same rule that
//    guards dal_analytics_permissions writes), and the recipient must be an existing
//    DalOS user (public.users.email) — never an arbitrary outside address.
//  - every caller-supplied string is HTML-escaped before it goes into the email.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "ramy.ahmed@daltexcorp.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("RESEND_FROM") || "DALos Analytics <noreply@daltexcorp.com>";
const APP_URL = Deno.env.get("APP_URL") || "https://daloshq.com/analytics/";
const REVIEW_URL = APP_URL + "?panel=access";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SB_URL, SB_SERVICE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
// plain-text field (subject line): strip control chars/newlines, cap length
function plain(s: unknown, max = 120): string {
  return String(s ?? "").replace(/[\r\n\t\x00-\x1f]/g, " ").slice(0, max);
}
function cap(s: unknown) {
  const t = String(s ?? "");
  return t.length ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function shell(inner: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#142850;background:#f8fafc">
  <div style="background:#142850;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <span style="color:#fff;font-size:20px;font-weight:700">Dal<span style="color:#DC6428">OS</span> Analytics</span>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">${inner}</div>
  <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center">Sent automatically by DalOS Analytics · Daltex Corp</p>
  </body></html>`;
}
// label is always a literal; value is ALREADY-escaped HTML
function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px">${label}</td><td style="padding:6px 0;font-weight:600;font-size:13px">${value}</td></tr>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return J({ error: "Method not allowed" }, 405);

  try {
    if (!RESEND_API_KEY) return J({ error: "RESEND_API_KEY not configured as a Supabase secret" }, 500);

    // ── auth: real signed-in DalOS user required ──
    const authz = req.headers.get("Authorization") || "";
    const token = authz.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === SB_ANON) return J({ error: "Sign in required" }, 401);
    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    const caller = ures?.user;
    if (uerr || !caller) return J({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "request");
    const userNameRaw = plain(body.userName || body.full_name || "A user", 80);
    const product = String(body.product || "");
    const productLabelRaw = plain(body.prodName || cap(product) || "DalOS Analytics", 80);
    const roleRaw = plain(body.role || "", 40);
    const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    const userName = esc(userNameRaw);
    const productLabel = esc(productLabelRaw);
    const role = esc(cap(roleRaw));

    let to: string[] = [];
    let subject = "";
    let inner = "";

    if (type === "request") {
      // requester identity comes from the JWT, not the body
      const requesterEmail = esc(caller.email || "");
      to = [ADMIN_EMAIL];
      subject = `Access Request: ${productLabelRaw} — ${userNameRaw}`;
      inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">🔐 New Access Request</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Someone is requesting access to DalOS Analytics</div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse">
          ${row("Name", userName)}${row("Email", requesterEmail)}
          ${row("Product", `<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-weight:600;font-size:12px">${productLabel}</span>`)}
          ${row("Requested", esc(when))}
        </table></div>
        <a href="${REVIEW_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:13px">Review in DalOS Analytics →</a>`;
    } else if (type === "approval" || type === "update" || type === "revoke" || type === "decline") {
      // admin-only: same rule as dal_analytics_permissions write policies
      const userClient = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: isAdm, error: aerr } = await userClient.rpc("is_admin");
      if (aerr || isAdm !== true) return J({ error: "Admin only" }, 403);

      const target = String(body.userEmail || body.email || "").trim().toLowerCase();
      if (!target) return J({ error: `userEmail required for ${type} email` }, 400);
      // recipient must be an existing DalOS user — never an arbitrary outside address
      const { data: urow } = await admin.from("users").select("email").ilike("email", target).maybeSingle();
      if (!urow?.email) return J({ error: "Recipient is not a DalOS user" }, 400);
      to = [urow.email];

      if (type === "approval" || type === "update") {
        const verb = type === "approval" ? "approved" : "updated";
        subject = `Your DalOS Analytics access has been ${verb}`;
        inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">✅ Access ${cap(verb)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your access to DalOS Analytics has been ${verb}.</div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse">
          ${productLabelRaw ? row("Product", productLabel) : ""}${roleRaw ? row("Access level", role) : ""}${row("Updated", esc(when))}
        </table></div>
        <a href="${APP_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:13px">Open DalOS Analytics →</a>`;
      } else if (type === "revoke") {
        subject = `Your DalOS Analytics access has been removed`;
        inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">Access Removed</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your access to DalOS Analytics has been removed. If you believe this is a mistake, please contact the administrator.</div>`;
      } else {
        subject = `Update on your DalOS Analytics access request`;
        inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">Access Request Update</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your request for access to ${productLabel} was not approved at this time. If you believe you need access, please contact the administrator.</div>`;
      }
    } else {
      return J({ error: "unknown type" }, 400);
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html: shell(inner) }),
    });
    const result = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) return J({ error: result }, 502);
    return J({ success: true, id: (result as any).id, type });
  } catch (e) {
    return J({ error: (e as Error).message }, 500);
  }
});
