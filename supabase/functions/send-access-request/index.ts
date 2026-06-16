import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "ramy.ahmed@daltexcorp.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const APP_URL = "https://daltexcorp-opsexcellence.github.io/dalos-analytics-dev/daltex_home.html";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userName, userEmail, product, requestId } = await req.json();

    const productLabel = product.charAt(0).toUpperCase() + product.slice(1);

    const emailBody = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#142850">
  <div style="background:#142850;border-radius:10px;padding:20px 24px;margin-bottom:24px">
    <span style="color:#fff;font-size:18px;font-weight:700">DAL<span style="color:#DC6428">Analytics</span></span>
  </div>
  <h2 style="margin:0 0 8px">New Access Request</h2>
  <p style="color:#64748b;margin:0 0 20px">Someone is requesting access to DALos Analytics.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Name</td><td style="padding:6px 0;font-weight:600;font-size:13px">${userName}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Email</td><td style="padding:6px 0;font-size:13px">${userEmail}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Product</td><td style="padding:6px 0;font-size:13px"><span style="background:#fff7ed;color:#c2410c;padding:2px 8px;border-radius:4px;font-weight:600">${productLabel}</span></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Requested</td><td style="padding:6px 0;font-size:13px">${new Date().toLocaleString('en-GB')}</td></tr>
    </table>
  </div>
  <a href="${APP_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px">
    Review in DALos Analytics →
  </a>
  <p style="color:#94a3b8;font-size:11px;margin-top:24px">This notification was sent automatically by DALos Analytics.</p>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DALos Analytics <noreply@daltexcorp.com>",
        to: [ADMIN_EMAIL],
        subject: `Access Request: ${productLabel} — ${userName}`,
        html: emailBody,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
