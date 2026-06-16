import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "ramy.ahmed@daltexcorp.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_L8C9FCed_4XwiPAMYFUXhXynswX9doyv3";
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
    const { userName, userEmail, product, prodName } = await req.json();
    const productLabel = prodName || (product.charAt(0).toUpperCase() + product.slice(1));

    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#142850;background:#f8fafc">
  <div style="background:#142850;border-radius:12px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center">
    <span style="color:#fff;font-size:20px;font-weight:700">DAL<span style="color:#DC6428">Analytics</span></span>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="width:40px;height:40px;border-radius:50%;background:#fff7ed;display:flex;align-items:center;justify-content:center;font-size:18px">🔐</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:#142850">New Access Request</div>
        <div style="font-size:12px;color:#64748b">Someone is requesting access to DALos Analytics</div>
      </div>
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:100px">Name</td>
          <td style="padding:6px 0;font-weight:600;font-size:13px">${userName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px">Email</td>
          <td style="padding:6px 0;font-size:13px">${userEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px">Product</td>
          <td style="padding:6px 0;font-size:13px">
            <span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-weight:600;font-size:12px">${productLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px">Requested</td>
          <td style="padding:6px 0;font-size:13px">${new Date().toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'})}</td>
        </tr>
      </table>
    </div>
    <a href="${APP_URL}" style="display:inline-block;background:#142850;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:13px">
      Review in DALos Analytics →
    </a>
  </div>
  <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center">Sent automatically by DALos Analytics · Daltex Corp</p>
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
        html: emailHtml,
      }),
    });

    const result = await emailRes.json();

    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
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
