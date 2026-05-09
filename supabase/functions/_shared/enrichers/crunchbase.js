/**
 * Shared enricher: Crunchbase scraper for investor and funding data.
 */

function domainToSlug(domain) {
  if (!domain || typeof domain !== 'string') return '';
  let slug = domain.trim().toLowerCase();
  slug = slug.replace(/^https?:\/\//, '');
  slug = slug.replace(/^www\./, '');
  slug = slug.replace(/\.[^.]+$/, '');
  slug = slug.replace(/\./g, '-');
  return slug;
}

function extractFundingData(data) {
  const result = { investors: [], total_raised: '', funding_rounds: [] };
  try {
    const pageProps = data?.props?.pageProps ?? data?.pageProps ?? {};
    const entityProps = pageProps?.entity?.properties ?? pageProps?.entity?.entityDef?.properties ?? {};
    const fundingTotal = entityProps?.funding_total ?? entityProps?.funding_total_usd ?? null;
    if (fundingTotal) {
      const rawValue = fundingTotal?.value_usd ?? fundingTotal?.converted_value ?? fundingTotal?.value ?? null;
      if (rawValue != null) result.total_raised = String(rawValue);
    }
    const roundsRaw = entityProps?.funding_rounds?.entities ?? entityProps?.funding_rounds ?? pageProps?.fundingRounds ?? null;
    if (Array.isArray(roundsRaw)) {
      result.funding_rounds = roundsRaw.map((r) => {
        const p = r?.properties ?? r ?? {};
        return { announced_on: p.announced_on ?? null, investment_type: p.investment_type ?? null, money_raised: p.money_raised?.value_usd ?? p.money_raised?.value ?? null };
      });
    }
    const investorsRaw = entityProps?.investors?.entities ?? entityProps?.lead_investors?.entities ?? pageProps?.investors ?? null;
    if (Array.isArray(investorsRaw)) {
      result.investors = investorsRaw.map((inv) => {
        const p = inv?.properties ?? inv ?? {};
        return p?.investor?.properties?.identifier?.value ?? p?.investor?.value ?? p?.name ?? p?.identifier?.value ?? null;
      }).filter(Boolean);
    }
    const searchResults = pageProps?.searchResults ?? [];
    if (Array.isArray(searchResults) && result.investors.length === 0) {
      for (const item of searchResults) {
        const props = item?.properties ?? {};
        if (props?.investor_identifiers) {
          const ids = props.investor_identifiers;
          if (Array.isArray(ids)) result.investors = ids.map((id) => id?.value ?? id).filter(Boolean);
          break;
        }
      }
    }
  } catch (_err) {}
  return result;
}

export async function enrichFromCrunchbase(domain) {
  try {
    const slug = domainToSlug(domain);
    if (!slug) return {};
    const url = `https://www.crunchbase.com/organization/${slug}`;
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (_fetchErr) { return {}; }
    if (!response.ok) return {};
    let html;
    try { html = await response.text(); } catch (_readErr) { return {}; }
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        return extractFundingData(nextData);
      } catch (_parseErr) {}
    }
    return {};
  } catch (_outerErr) { return {}; }
}
