// Centralized service layer.
// Today: reads from local JSON. Tomorrow: swap each function body to Supabase.
// All views import from this file — no view talks to Supabase directly.

import resourcesLocal from '../data/resources.json'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = (url && key) ? createClient(url, key) : null
const useSupabase = !!supabase

// ---- domain constants (mirrored client-side for matching) ----
export const STAGE_OPTIONS = [
  { id: 'pre',     title: 'Pre-revenue',   sub: 'Idea, prototype, or first build' },
  { id: 'early',   title: 'Early revenue', sub: 'First customers, hunting traction' },
  { id: 'scaling', title: 'Scaling',       sub: 'Repeatable revenue, growing team' },
  { id: 'est',     title: 'Established',   sub: 'Mature operations, broad needs' },
]
export const INDUSTRY_OPTIONS = [
  { id: 'sw',     title: 'Software / IT',     sub: 'SaaS, AI, dev tools, infra', match: 'Software and Information Technology' },
  { id: 'health', title: 'Healthcare',        sub: 'Life sciences, medtech, care', match: 'Life Sciences and Healthcare' },
  { id: 'mfg',    title: 'Manufacturing',     sub: 'Hardware, industrial, defense', match: 'Manufacturing' },
  { id: 'ag',     title: 'Agriculture',       sub: 'Food, ag-tech, rural enterprise', match: 'Agriculture' },
  { id: 'hosp',   title: 'Hospitality / Food', sub: 'Restaurants, retail, services', match: 'Hospitality and Food Services' },
  { id: 'other',  title: 'Other',             sub: 'Something else, mixed, unsure', match: 'Other' },
]
export const TOPIC_OPTIONS = [
  { id: 'fund',   title: 'Funding',           sub: 'Capital, grants, investment', match: 'Funding' },
  { id: 'talent', title: 'Talent & hiring',   sub: 'Workforce, recruiting, training', match: 'Late Stage Growth' },
  { id: 'comm',   title: 'Community',         sub: 'Network, mentors, peer founders', match: 'Entrepreneurship Communities' },
  { id: 'legal',  title: 'Legal & compliance', sub: 'Formation, IP, taxes', match: 'Taxes and Finance' },
  { id: 'mkt',    title: 'Marketing',         sub: 'Sales, brand, go-to-market', match: 'Marketing and Sales' },
]
export const STAGE_TO_COMM = {
  pre: ['Student','Rural','Multicultural','New American'],
  early: ['Student','Multicultural','New American','Women'],
  scaling: ['Women','Veteran'],
  est: ['*'],
}

// ---- read ----
export async function getResources() {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('resources').select('*').order('title')
    if (error) throw error
    return data.map(normalize)
  }
  return resourcesLocal
}

export async function getResourceById(id) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('resources').select('*').eq('id', id).single()
    if (error) throw error
    return normalize(data)
  }
  return resourcesLocal.find(r => String(r.id) === String(id))
}

// ---- score ----
export async function scoreQuiz({ stage, industry, topic, location }) {
  const all = await getResources()
  const indMatch = INDUSTRY_OPTIONS.find(o => o.id === industry)?.match
  const topMatch = TOPIC_OPTIONS.find(o => o.id === topic)?.match
  const commList = STAGE_TO_COMM[stage] || []
  const isAny = commList.includes('*')

  const scored = all.map(r => {
    let score = 0
    const reasons = []
    if (indMatch && r.industries.includes(indMatch)) { score += 100; reasons.push(['Industry', indMatch]) }
    else if (industry === 'other' && r.industries.includes('Other')) { score += 50; reasons.push(['Industry','Other']) }
    if (topMatch && r.topics.includes(topMatch)) { score += 80; reasons.push(['Topic', topMatch]) }
    if (commList.length) {
      if (isAny || r.communities.length === 0) { score += 20 }
      else if (r.communities.some(c => commList.includes(c))) {
        score += 40; reasons.push(['Community', r.communities.find(c => commList.includes(c))])
      }
    }
    if (location && r.locations.includes(location)) { score += 20; reasons.push(['County', location]) }
    if (r.communities.some(c => ['Women','Veteran','Multicultural','New American'].includes(c))) score += 5
    return { ...r, score, reasons }
  }).filter(r => r.score > 0)

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return scored.slice(0, 24)
}

// ---- write ----
export async function submitProfile(payload) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('startup_profiles')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return { ok: true, id: data.id }
  }
  console.log('[stub] submitProfile', payload)
  await new Promise(r => setTimeout(r, 600))
  return { ok: true, id: 'stub-' + Date.now() }
}

// ---- helpers ----
function normalize(r) {
  // tolerate either pipe-strings (raw CSV import) or arrays (already-normalized)
  const arr = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split('|').map(s => s.trim()).filter(Boolean) : [])
  return {
    id: r.id,
    title: r.title || r.Title,
    description: r.description,
    communities: arr(r.communities ?? r.Communities),
    industries: arr(r.industries ?? r.Industries),
    locations: arr(r.locations ?? r.Locations),
    topics: arr(r.topics ?? r.Topics),
    link: r.link,
    email: r.email,
  }
}
