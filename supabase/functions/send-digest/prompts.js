/**
 * Prompt assets for the send-digest Edge Function.
 *
 * Three exports:
 *   SYSTEM_PROMPT             — establishes AI as Utah startup ecosystem analyst
 *   buildPersonalizedPrompt() — user prompt for subscribers with matching updates
 *   buildEcosystemPrompt()    — user prompt for subscribers with no matching updates
 */

/**
 * System prompt establishing the AI as a Utah startup ecosystem analyst.
 * Instructs the model to always respond with valid JSON shaped exactly
 * `{ "subject": string, "htmlBody": string }` — no markdown, no code fences.
 *
 * @type {string}
 */
export const SYSTEM_PROMPT = `You are a Utah startup ecosystem analyst writing a weekly digest email for founders, investors, and tech enthusiasts in Utah.

Your tone is informative, concise, and professional. Avoid marketing fluff, hype, or filler language. Write like a knowledgeable local journalist covering the Utah tech scene.

Ground all content in Utah context: reference Silicon Slopes, Salt Lake City, Provo, Ogden, and the broader Wasatch Front startup community where relevant.

You MUST respond with valid JSON and nothing else. The JSON must be shaped exactly as follows:
{
  "subject": "<email subject line>",
  "htmlBody": "<full HTML body of the email>"
}

Do NOT wrap your response in markdown code fences. Do NOT include any explanation text outside the JSON. Return only the raw JSON object.`;

/**
 * Build a personalized user prompt for a subscriber who has matching startup updates.
 *
 * Reads `subscriber.filter_criteria` jsonb with shape
 * `{ sectors, stages, regions, hiring_only, investor }`.
 * Gracefully handles missing/empty filter_criteria — calling with `{}` must NOT throw.
 *
 * @param {object} subscriber - Subscription row from map_subscriptions (may be empty `{}`).
 * @param {Array<object>} updates - Array of map_startups rows matching the subscriber's filters.
 * @returns {string} Non-empty user prompt string.
 */
export function buildPersonalizedPrompt(subscriber, updates) {
  const fc = (subscriber && subscriber.filter_criteria) ? subscriber.filter_criteria : {};

  const sectorsNote = Array.isArray(fc.sectors) && fc.sectors.length > 0
    ? `Sectors of interest: ${fc.sectors.join(', ')}.`
    : 'No sector filter applied.';

  const stagesNote = Array.isArray(fc.stages) && fc.stages.length > 0
    ? `Stages of interest: ${fc.stages.join(', ')}.`
    : 'No stage filter applied.';

  const regionsNote = Array.isArray(fc.regions) && fc.regions.length > 0
    ? `Regions of interest: ${fc.regions.join(', ')}.`
    : 'No region filter applied.';

  const hiringNote = fc.hiring_only === true
    ? 'Subscriber is only interested in companies that are actively hiring.'
    : '';

  const investorNote = fc.investor === true
    ? 'Subscriber is an investor — emphasize funding rounds, traction, and growth signals.'
    : '';

  const updatesList = Array.isArray(updates) && updates.length > 0
    ? updates.map((u) => {
        return [
          `Name: ${u.name ?? 'Unknown'}`,
          `Sector: ${u.sector ?? 'N/A'}`,
          `Stage: ${u.stage ?? 'N/A'}`,
          `Region: ${u.region ?? 'N/A'}`,
          `Is Hiring: ${u.is_hiring ? 'Yes' : 'No'}`,
          `Description: ${u.description ?? 'No description available.'}`,
          `Added/Updated: ${u.created_at ?? 'N/A'}`,
        ].join(' | ');
      }).join('\n')
    : '(No specific updates this week)';

  return `You are writing the weekly Utah Startup Map digest for a subscriber.

Subscriber filter preferences:
- ${sectorsNote}
- ${stagesNote}
- ${regionsNote}
${hiringNote ? `- ${hiringNote}` : ''}
${investorNote ? `- ${investorNote}` : ''}

Companies that were added or updated in the Utah Startup Map this week matching the subscriber's filters:

${updatesList}

Instructions:
- Write a subject line that is specific and informative (not generic like "Weekly Digest").
- Write 2–4 paragraphs of HTML email body covering what changed this week in the Utah startup ecosystem for this subscriber's areas of interest.
- Keep the tone professional and concise. No marketing fluff.
- Reference Utah geography (Silicon Slopes, SLC, Provo, Ogden) where appropriate.
- The htmlBody should be valid HTML fragments (not a full HTML document) suitable for embedding in an email template.

Respond with valid JSON only, shaped exactly as:
{ "subject": "<subject line>", "htmlBody": "<html body content>" }`;
}

/**
 * Build an ecosystem-wide user prompt for a subscriber who had no matching updates.
 *
 * @param {object} subscriber - Subscription row from map_subscriptions (may be empty `{}`).
 * @param {{ hiringCount: number, newestCompany: object|null, totalCompanies: number, mostViewed?: Array<{ name: string, sector: string|null, stage: string|null, view_count: number }> }} highlights
 *   Ecosystem-wide stats to include in the email when no personalized matches exist.
 *   `mostViewed` is optional — an array of the top-viewed companies on the map in the past 7 days,
 *   each with `{ name, sector, stage, view_count }`. Omit or pass `[]` to suppress the section.
 * @returns {string} Non-empty user prompt string.
 */
export function buildEcosystemPrompt(subscriber, highlights) {
  const { hiringCount = 0, newestCompany = null, totalCompanies = 0, mostViewed = [] } = highlights ?? {};

  const fc = (subscriber && subscriber.filter_criteria) ? subscriber.filter_criteria : {};

  const preferenceSummary = [
    Array.isArray(fc.sectors) && fc.sectors.length > 0 ? `sectors: ${fc.sectors.join(', ')}` : null,
    Array.isArray(fc.stages) && fc.stages.length > 0 ? `stages: ${fc.stages.join(', ')}` : null,
    Array.isArray(fc.regions) && fc.regions.length > 0 ? `regions: ${fc.regions.join(', ')}` : null,
    fc.hiring_only === true ? 'hiring companies only' : null,
  ].filter(Boolean).join('; ');

  const newestCompanyNote = newestCompany
    ? `The most recently added company is "${newestCompany.name ?? 'Unknown'}" (${newestCompany.sector ?? 'N/A'} sector, ${newestCompany.region ?? 'N/A'} region).`
    : 'No new companies have been added recently.';

  const mostViewedNote = Array.isArray(mostViewed) && mostViewed.length > 0
    ? `Most-viewed companies on the map this past week (top ${mostViewed.length}):\n${
        mostViewed.map((c, i) =>
          `${i + 1}. ${c.name} — ${c.sector ?? 'N/A'} sector, ${c.stage ?? 'N/A'} stage (${c.view_count} views)`
        ).join('\n')
      }`
    : '';

  return `You are writing the weekly Utah Startup Map digest for a subscriber who had no new startup activity matching their filters this week.

Subscriber filter preferences: ${preferenceSummary || 'No specific filters set.'}

This week there were no new or updated companies matching this subscriber's filters. Instead, share a broader ecosystem update using these stats:

- Total companies tracked on Utah Startup Map: ${totalCompanies}
- Companies currently hiring across all of Utah: ${hiringCount}
- ${newestCompanyNote}
${mostViewedNote ? `\n${mostViewedNote}\n` : ''}
Instructions:
- Write a subject line that acknowledges the quieter week for their specific interests while highlighting broader Utah startup activity.
- Write 2–3 paragraphs of HTML email body covering the broader Utah startup ecosystem activity.
- Mention Silicon Slopes and Utah's tech community context.
- Encourage the subscriber to check the full map for the latest listings.
- The htmlBody should be valid HTML fragments (not a full HTML document) suitable for embedding in an email template.
${mostViewedNote ? '- Reference the most-viewed companies above as a signal of what is catching the ecosystem\'s attention this week.' : ''}
Respond with valid JSON only, shaped exactly as:
{ "subject": "<subject line>", "htmlBody": "<html body content>" }`;
}
