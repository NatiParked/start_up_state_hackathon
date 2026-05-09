/**
 * send-digest — generates and emails the weekly AI digest to confirmed subscribers.
 * Service-role auth required.
 *
 * Fetches all confirmed map_subscriptions, queries map_startups for updates since
 * each subscriber's last_digest_sent timestamp, generates a personalized HTML email
 * via Gemini AI, and sends it via Resend. Logs each run to map_digest_runs.
 *
 * Returns: { sent: number, errors: number }
 */

import { createAdminClient } from '../_shared/supabaseAdmin.js';
import { callLLM } from '../_shared/llm.js';
import { SYSTEM_PROMPT, buildPersonalizedPrompt, buildEcosystemPrompt } from './prompts.js';

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
    // 3. Env + client
    // -------------------------------------------------------------------------
    // Read key now but validate only when actually sending (so 0-subscriber runs succeed)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // NOTE: onboarding@resend.dev is the Resend sandbox sender for hackathon demo;
    // production must set RESEND_FROM_EMAIL to a verified-domain address
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

    const adminClient = createAdminClient();

    // -------------------------------------------------------------------------
    // 4. Fetch confirmed subscribers
    // -------------------------------------------------------------------------
    const { data: subscribers, error: subsError } = await adminClient
      .from('map_subscriptions')
      .select('*')
      .eq('confirmed', true);

    if (subsError) throw subsError;

    // -------------------------------------------------------------------------
    // 5. Initialize counters
    // -------------------------------------------------------------------------
    let subscribersSent = 0;
    let errors = 0;

    // -------------------------------------------------------------------------
    // 6. Loop subscribers
    // -------------------------------------------------------------------------
    for (const subscriber of subscribers ?? []) {
      try {
        // a. Determine the cutoff timestamp for this subscriber
        const lastDigestSent = subscriber.last_digest_sent ?? '1970-01-01T00:00:00Z';

        // b. Build map_startups query filtered by subscriber preferences
        let query = adminClient
          .from('map_startups')
          .select('*')
          .or(`created_at.gt.${lastDigestSent},updated_at.gt.${lastDigestSent}`);

        const fc = subscriber.filter_criteria ?? {};

        if (Array.isArray(fc.sectors) && fc.sectors.length > 0) {
          query = query.in('sector', fc.sectors);
        }
        if (Array.isArray(fc.stages) && fc.stages.length > 0) {
          query = query.in('stage', fc.stages);
        }
        if (Array.isArray(fc.regions) && fc.regions.length > 0) {
          query = query.in('region', fc.regions);
        }
        if (fc.hiring_only === true) {
          query = query.eq('is_hiring', true);
        }

        const { data: updates, error: updatesError } = await query;
        if (updatesError) throw updatesError;

        // c. Mode selection: personalized if there are matches, ecosystem-wide otherwise
        let mode;
        let userPrompt;

        if ((updates?.length ?? 0) >= 1) {
          mode = 'personalized';
          userPrompt = buildPersonalizedPrompt(subscriber, updates);
        } else {
          mode = 'ecosystem';

          const { count: hiringCount } = await adminClient
            .from('map_startups')
            .select('*', { count: 'exact', head: true })
            .eq('is_hiring', true);

          const { count: totalCompanies } = await adminClient
            .from('map_startups')
            .select('*', { count: 'exact', head: true });

          const { data: newestCompany } = await adminClient
            .from('map_startups')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Most-viewed companies in the past 7 days, top 5
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          let mostViewed = [];
          try {
            const { data: viewRows, error: viewsError } = await adminClient
              .from('company_views')
              .select('startup_id')
              .gte('viewed_at', sevenDaysAgo);

            if (viewsError) throw viewsError;

            if (viewRows && viewRows.length > 0) {
              // Aggregate counts in JS (PostgREST cannot GROUP BY without a view/RPC)
              const counts = new Map();
              for (const row of viewRows) {
                counts.set(row.startup_id, (counts.get(row.startup_id) ?? 0) + 1);
              }
              const topIds = [...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id]) => id);

              if (topIds.length > 0) {
                const { data: topCompanies } = await adminClient
                  .from('map_startups')
                  .select('id, name, sector, stage')
                  .in('id', topIds);

                // Reattach counts in the original sort order
                mostViewed = topIds
                  .map((id) => {
                    const co = (topCompanies ?? []).find((c) => c.id === id);
                    if (!co) return null;
                    return { name: co.name, sector: co.sector, stage: co.stage, view_count: counts.get(id) };
                  })
                  .filter(Boolean);
              }
            }
          } catch (mvErr) {
            // Never let most-viewed enrichment break the digest — log and continue with empty array
            console.error('most-viewed query failed', mvErr);
            mostViewed = [];
          }

          userPrompt = buildEcosystemPrompt(subscriber, { hiringCount, newestCompany, totalCompanies, mostViewed });
        }

        // d. Call LLM for subject + htmlBody
        const llmResult = await callLLM({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              htmlBody: { type: 'string' },
            },
            required: ['subject', 'htmlBody'],
          },
        });

        // Defensive parse: llmResult may come back as a string in some edge cases
        let subject, htmlBody;
        if (typeof llmResult === 'string') {
          try {
            const parsed = JSON.parse(llmResult);
            subject = parsed.subject;
            htmlBody = parsed.htmlBody;
          } catch (parseErr) {
            throw new Error(`LLM returned unparseable string: ${parseErr.message}`);
          }
        } else {
          subject = llmResult.subject;
          htmlBody = llmResult.htmlBody;
        }

        // e. Build unsubscribe footer and Resend payload
        // unsubscribe identifier is confirm_token (locked decision — NOT subscriber.id)
        const unsubscribeUrl = `${Deno.env.get('PUBLIC_SITE_URL') ?? 'https://utah-startup-map.com'}/subscribe?unsubscribe=${subscriber.confirm_token}`;
        const unsubscribeFooter = `<p style="font-size:12px;color:#888;margin-top:32px;">You're receiving this because you subscribed to Utah Startup Map digests. <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>`;

        const resendPayload = {
          from: `Utah Startup Map <${RESEND_FROM_EMAIL}>`,
          to: subscriber.email,
          subject,
          html: htmlBody + unsubscribeFooter,
        };

        // f. Send via Resend
        if (!RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY env var is required');
        }
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(resendPayload),
        });

        if (!resendRes.ok) {
          const resendErr = await resendRes.text();
          throw new Error(`Resend API error ${resendRes.status}: ${resendErr}`);
        }

        // g. Update last_digest_sent and increment counter
        await adminClient
          .from('map_subscriptions')
          .update({ last_digest_sent: new Date().toISOString() })
          .eq('id', subscriber.id);

        subscribersSent += 1;

        console.log(`Digest sent (${mode}) to ${subscriber.email}`);
      } catch (err) {
        console.error('subscriber failed', subscriber.email, err);
        errors += 1;
      }
    }

    // -------------------------------------------------------------------------
    // 7. Log the run
    // -------------------------------------------------------------------------
    try {
      await adminClient
        .from('map_digest_runs')
        .insert({ subscribers_sent: subscribersSent, errors });
    } catch (logErr) {
      console.error('failed to insert digest run log', logErr);
    }

    // -------------------------------------------------------------------------
    // 8. Return summary
    // -------------------------------------------------------------------------
    return jsonResponse({ sent: subscribersSent, errors }, 200);
  } catch (err) {
    console.error('send-digest fatal error', err);
    return errorResponse('internal_error', err.message ?? 'internal_error', 500);
  }
});
