import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "ramy.ahmed@daltexcorp.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
// FROM uses the verified daltexcorp.com domain so Resend delivers to any recipient
// (admin + users), not just the account owner. Can be overridden via RESEND_FROM secret.
const FROM = Deno.env.get("RESEND_FROM") || "DALos Analytics <noreply@daltexcorp.com>";
const APP_URL = "https://daltexcorp-opsexcellence.github.io/dalos-workspace-dev/daltex_home.html";
const REVIEW_URL = APP_URL + "?panel=access";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function cap(s) {
  s = (s || "").toString();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shell(inner) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#142850;background:#f8fafc">
  <div style="background:#142850;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <span style="color:#fff;font-size:20px;font-weight:700">Dal<span style="color:#DC6428">OS</span> Analytics</span>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">${inner}</div>
  <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center">Sent automatically by DalOS Analytics · Daltex Corp</p>
  </body></html>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px">${label}</td><td style="padding:6px 0;font-weight:600;font-size:13px">${value}</td></tr>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured as a Supabase secret" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    // type: "request" (default) emails the admin; "approval"/"update"/"revoke" emails the user
    const type = (body.type || "request").toString();
    const userName = (body.userName || body.full_name || "A user").toString();
    const userEmail = (body.userEmail || body.email || "").toString();
    const product = (body.product || "").toString();
    const productLabel = (body.prodName || cap(product) || "DalOS Analytics").toString();
    const role = (body.role || "").toString();
    const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    let to = [];
    let subject = "";
    let inner = "";

    if (type === "request") {
      to = [ADMIN_EMAIL];
      subject = `Access Request: ${productLabel} — ${userName}`;
      inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">🔐 New Access Request</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Someone is requesting access to DalOS Analytics</div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse">
          ${row("Name", userName)}${row("Email", userEmail)}
          ${row("Product", `<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-weight:600;font-size:12px">${productLabel}</span>`)}
          ${row("Requested", when)}
        </table></div>
        <a href="${REVIEW_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:13px">Review in DalOS Analytics →</a>`;
    } else if (type === "approval" || type === "update") {
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "userEmail required for approval email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      to = [userEmail];
      const verb = type === "approval" ? "approved" : "updated";
      subject = `Your DalOS Analytics access has been ${verb}`;
      inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">✅ Access ${cap(verb)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your access to DalOS Analytics has been ${verb}.</div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px"><table style="width:100%;border-collapse:collapse">
          ${productLabel ? row("Product", productLabel) : ""}${role ? row("Access level", cap(role)) : ""}${row("Updated", when)}
        </table></div>
        <a href="${APP_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:13px">Open DalOS Analytics →</a>`;
    } else if (type === "revoke") {
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "userEmail required for revoke email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      to = [userEmail];
      subject = `Your DalOS Analytics access has been removed`;
      inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">Access Removed</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your access to DalOS Analytics has been removed. If you believe this is a mistake, please contact the administrator.</div>`;
    } else if (type === "decline") {
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "userEmail required for decline email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      to = [userEmail];
      subject = `Update on your DalOS Analytics access request`;
      inner = `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">Access Request Update</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:16px">Hi ${userName}, your request for access to ${productLabel} was not approved at this time. If you believe you need access, please contact the administrator.</div>`;
    } else {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html: shell(inner) }),
    });

    const result = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, id: result.id, type, to }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
