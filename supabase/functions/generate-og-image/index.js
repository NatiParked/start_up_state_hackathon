/**
 * generate-og-image — Render a branded 1200×630 Open Graph PNG for a company.
 *
 * Public URL shape:
 *   GET /generate-og-image/og/<uuid>.png
 *
 * Returns:
 *   - 200 image/png with Cache-Control: public, max-age=86400, s-maxage=86400 on success
 *   - 200 image/png with Cache-Control: no-cache on any error / unknown id (fallback PNG)
 *   - Never returns 5xx for routine bad inputs.
 *
 * Env vars consumed:
 *   SUPABASE_URL      — project API URL
 *   SUPABASE_ANON_KEY — project anon key
 *   LOGO_DEV_TOKEN    — img.logo.dev public token (optional; logo skipped if absent)
 *
 * Example:
 *   curl -s https://<project>.supabase.co/functions/v1/generate-og-image/og/<uuid>.png \
 *     --output card.png
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import satori from 'npm:satori@0.10.13'
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2'
import { normalizeDomain } from '../_shared/logo-dev.js'

// ---------------------------------------------------------------------------
// Inline minimal 1×1 transparent PNG — last-resort fallback if fallback.png
// is missing and the caller is requesting a fallback response.
// ---------------------------------------------------------------------------
const MINIMAL_FALLBACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// ---------------------------------------------------------------------------
// Module-level cold-start initialization (runs once per isolate)
// ---------------------------------------------------------------------------

let wasmReady = true
try {
  const wasmRes = await fetch(
    'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
  )
  const wasmBuf = await wasmRes.arrayBuffer()
  await initWasm(wasmBuf)
  console.log('[generate-og-image] resvg WASM initialized')
} catch (err) {
  console.error('[generate-og-image] resvg WASM init failed:', err)
  wasmReady = false
}

const interRegular = await fetch(
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
).then((r) => r.arrayBuffer())
console.log('[generate-og-image] Inter Regular loaded')

const interBold = await fetch(
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
).then((r) => r.arrayBuffer())
console.log('[generate-og-image] Inter Bold loaded')

let fallbackPng = null
try {
  fallbackPng = await Deno.readFile(new URL('./fallback.png', import.meta.url))
} catch {
  console.log('[generate-og-image] fallback.png not found — using inline minimal PNG')
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY'),
)

// ---------------------------------------------------------------------------
// CORS headers (inline — no _shared/cors.js in this repo)
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Helper: always returns a valid PNG response (never throws)
// ---------------------------------------------------------------------------
function fallbackResponse() {
  const body = fallbackPng !== null
    ? fallbackPng
    : Uint8Array.from(atob(MINIMAL_FALLBACK_PNG_BASE64), (c) => c.charCodeAt(0))
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache',
    },
  })
}

// ---------------------------------------------------------------------------
// Helper: encode ArrayBuffer to base64 in chunks (avoids call-stack overflow
// on large buffers when using String.fromCharCode spread)
// ---------------------------------------------------------------------------
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return fallbackResponse()
  }

  try {
    // Parse path: /generate-og-image/og/<uuid>.png
    const url = new URL(req.url)
    const pathMatch = url.pathname.match(/\/og\/([^/]+)\.png$/)
    if (!pathMatch) {
      return fallbackResponse()
    }

    const id = pathMatch[1]
    if (!UUID_REGEX.test(id)) {
      return fallbackResponse()
    }

    // DB lookup
    const { data: company, error: dbError } = await supabase
      .from('map_startups')
      .select('id, name, sector, stage, website')
      .eq('id', id)
      .maybeSingle()

    if (dbError || !company) {
      return fallbackResponse()
    }

    // Logo fetch
    let logoDataUri = null
    const token = Deno.env.get('LOGO_DEV_TOKEN')
    if (company.website && token) {
      try {
        const domain = normalizeDomain(company.website)
        if (domain) {
          const logoRes = await fetch(
            `https://img.logo.dev/${domain}?token=${token}&size=256`,
          )
          if (logoRes.ok) {
            const logoBuf = await logoRes.arrayBuffer()
            const b64 = arrayBufferToBase64(logoBuf)
            logoDataUri = `data:image/png;base64,${b64}`
          }
        }
      } catch {
        // logo fetch failure is non-fatal; fall through to letter fallback
      }
    }

    // Truncate name
    const companyName = (company.name || '').slice(0, 60)

    // VDOM children helpers
    const logoEl = logoDataUri
      ? {
          type: 'img',
          props: {
            src: logoDataUri,
            width: 96,
            height: 96,
            style: {
              width: 96,
              height: 96,
              borderRadius: 16,
              objectFit: 'contain',
              backgroundColor: 'white',
            },
          },
        }
      : {
          type: 'div',
          props: {
            style: {
              width: 96,
              height: 96,
              borderRadius: 16,
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700,
              color: '#0065A4',
            },
            children: ['U'],
          },
        }

    const sectorPill = {
      type: 'div',
      props: {
        style: {
          backgroundColor: '#10B981',
          color: 'white',
          padding: '8px 20px',
          borderRadius: 999,
          fontSize: 24,
          fontWeight: 600,
        },
        children: [company.sector || 'Startup'],
      },
    }

    const pillsChildren = [sectorPill]
    if (company.stage) {
      pillsChildren.push({
        type: 'div',
        props: {
          style: {
            backgroundColor: 'white',
            color: '#0065A4',
            padding: '8px 20px',
            borderRadius: 999,
            fontSize: 24,
            fontWeight: 600,
          },
          children: [company.stage],
        },
      })
    }

    const vdom = {
      type: 'div',
      props: {
        style: {
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          padding: 64,
          backgroundColor: '#0065A4',
          color: 'white',
          fontFamily: 'Inter',
          justifyContent: 'space-between',
        },
        children: [
          // Top row: logo
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
              },
              children: [logoEl],
            },
          },
          // Middle: company name
          {
            type: 'div',
            props: {
              style: {
                fontSize: 72,
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.1,
              },
              children: [companyName],
            },
          },
          // Bottom row: pills + footer
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 16,
                      alignItems: 'center',
                    },
                    children: pillsChildren,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 18,
                      opacity: 0.8,
                      color: 'white',
                    },
                    children: ['utahstartups.com'],
                  },
                },
              ],
            },
          },
        ],
      },
    }

    // Satori: VDOM → SVG
    const svg = await satori(vdom, {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    })

    // resvg: SVG → PNG
    if (!wasmReady) {
      return fallbackResponse()
    }
    const png = new Resvg(svg).render().asPng()

    return new Response(png, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })

  } catch (err) {
    console.error('[generate-og-image]', err)
    return fallbackResponse()
  }
})
