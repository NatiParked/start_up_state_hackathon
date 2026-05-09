/**
 * send-confirmation — sends a confirmation email to a new map_subscriptions record.
 *
 * Accepts POST { email: string }. Looks up the pending subscription, builds an
 * HTML email with a confirm button, and sends it via Resend.
 *
 * Returns: { ok: true }
 */

import { createAdminClient } from '../_shared/supabaseAdmin.js';

/** CORS headers required for browser invocations. */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Build a JSON Response with CORS headers always present.
 *
 * @param {object} body
 * @param {number} [status=200]
 * @returns {Response}
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Build a JSON error Response with CORS headers.
 *
 * @param {string} code - Machine-readable error code.
 * @param {string} message - Human-readable error message.
 * @param {number} [status=500]
 * @returns {Response}
 */
function errorResponse(code, message, status = 500) {
  return jsonResponse({ error: message, code }, status);
}

Deno.serve(async (req) => {
  try {
    // -------------------------------------------------------------------------
    // 1. CORS preflight
    // -------------------------------------------------------------------------
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // -------------------------------------------------------------------------
    // 2. Method guard
    // -------------------------------------------------------------------------
    if (req.method !== 'POST') {
      return errorResponse('method_not_allowed', 'method_not_allowed', 405);
    }

    // -------------------------------------------------------------------------
    // 3. Parse body
    // -------------------------------------------------------------------------
    const { email } = await req.json();
    if (!email) {
      return errorResponse('bad_request', 'email required', 400);
    }

    // -------------------------------------------------------------------------
    // 4. Admin client
    // -------------------------------------------------------------------------
    const adminClient = createAdminClient();

    // -------------------------------------------------------------------------
    // 5. Look up subscription record
    // -------------------------------------------------------------------------
    const { data: row, error: lookupError } = await adminClient
      .from('map_subscriptions')
      .select('id, confirm_token')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!row) {
      return errorResponse('not_found', 'email not found', 400);
    }

    // -------------------------------------------------------------------------
    // 6. Defer-validate RESEND_API_KEY (only throw on the send path)
    // -------------------------------------------------------------------------
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // NOTE: onboarding@resend.dev is the Resend sandbox sender for hackathon demo;
    // production must set RESEND_FROM_EMAIL to a verified-domain address
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

    // -------------------------------------------------------------------------
    // 7. Build confirm URL
    // -------------------------------------------------------------------------
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const confirmUrl = `${SUPABASE_URL}/functions/v1/confirm-subscription?token=${row.confirm_token}`;

    // -------------------------------------------------------------------------
    // 8. Build email content
    // -------------------------------------------------------------------------
    const subject = 'Confirm your Utah Startup Map subscription';
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0d3b66;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Utah Startup Map</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0d3b66;font-size:20px;">Confirm your subscription</h2>
              <p style="margin:0 0 24px;color:#444444;font-size:15px;line-height:1.6;">
                Thanks for subscribing to Utah Startup Map! Click the button below to confirm your
                email address and start receiving weekly digest updates about Utah's startup ecosystem.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${confirmUrl}"
                       style="display:inline-block;background:#0d3b66;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;">
                      Confirm Subscription
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#888888;font-size:13px;line-height:1.5;">
                If you didn't subscribe to Utah Startup Map, you can safely ignore this email.
                This link expires after use.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f6f9;padding:20px 40px;">
              <p style="margin:0;color:#aaaaaa;font-size:12px;">
                &copy; ${new Date().getFullYear()} Utah Startup Map. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    // -------------------------------------------------------------------------
    // 9. Send via Resend (validate key here, on the send path)
    // -------------------------------------------------------------------------
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY env var is required');
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Utah Startup Map <${RESEND_FROM_EMAIL}>`,
        to: email,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const resendBody = await resendRes.text();
      return errorResponse('resend_error', `resend_error: ${resendRes.status} ${resendBody}`, 500);
    }

    // -------------------------------------------------------------------------
    // 10. Success
    // -------------------------------------------------------------------------
    console.log(`Confirmation email sent to ${email}`);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error('send-confirmation fatal error', err);
    return errorResponse('internal_error', err.message ?? 'internal_error', 500);
  }
});
