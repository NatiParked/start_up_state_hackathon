// Centralized service layer — reads from tagged_resources.json (local) or Supabase.
// All views import from this file only.

import resourcesLocal from '../data/tagged_resources.json'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = (url && key) ? createClient(url, key) : null

// ---- domain constants ----

export const STAGE_OPTIONS = [
  { id: 'idea',        title: 'Just an idea',   sub: 'Exploring or pre-product' },
  { id: 'early_stage', title: 'Early stage',    sub: 'First customers, hunting traction' },
  { id: 'growth',      title: 'Scaling',        sub: 'Repeatable revenue, growing team' },
]

export const INDUSTRY_OPTIONS = [
  { id: 'tech_software',      title: 'Software / Tech',            sub: 'SaaS, AI, dev tools, infra' },
  { id: 'life_sciences',      title: 'Healthcare / Life Sciences',  sub: 'Life sciences, medtech, care' },
  { id: 'agriculture_food',   title: 'Agriculture & Food',          sub: 'Food, ag-tech, rural enterprise' },
  { id: 'consumer_brands',    title: 'Consumer Goods & Retail',     sub: 'Brands, retail, e-commerce' },
  { id: 'manufacturing',      title: 'Manufacturing',               sub: 'Hardware, industrial, defense' },
  { id: 'hospitality_tourism',title: 'Hospitality & Tourism',       sub: 'Restaurants, travel, services' },
  { id: 'arts_media',         title: 'Arts & Media',                sub: 'Creative, film, entertainment' },
  { id: 'aerospace_defense',  title: 'Aerospace & Defense',         sub: 'Aerospace, defense, government' },
  { id: 'general',            title: 'Other',                       sub: 'Something else or mixed' },
]

export const TOPIC_OPTIONS = [
  { id: 'raise_capital',          title: 'Raise funding',              sub: 'Capital, grants, investment' },
  { id: 'start_business',         title: 'Start my business',          sub: 'Formation, licensing, launch' },
  { id: 'validate_idea',          title: 'Validate my idea',           sub: 'Research, pilots, feedback' },
  { id: 'hire_workforce',         title: 'Hire & build a team',        sub: 'Workforce, recruiting, training' },
  { id: 'grow_sales_marketing',   title: 'Grow sales & marketing',     sub: 'Sales, brand, go-to-market' },
  { id: 'network_community',      title: 'Find community & mentors',   sub: 'Network, mentors, peer founders' },
  { id: 'find_workspace',         title: 'Find a workspace',           sub: 'Office, coworking, makerspace' },
  { id: 'government_contracting', title: 'Government contracting',     sub: 'Federal, state, procurement' },
  { id: 'export_internationally', title: 'Export internationally',     sub: 'Global markets, trade support' },
  { id: 'relocate_to_utah',       title: 'Relocate to Utah',           sub: 'Move or expand operations to Utah' },
]

export const REGION_OPTIONS = [
  { id: 'salt_lake_metro',  title: 'Salt Lake Metro',      sub: 'Salt Lake City and surroundings' },
  { id: 'silicon_slopes',   title: 'Silicon Slopes',       sub: 'Lehi, Provo, Orem area' },
  { id: 'northern_utah',    title: 'Northern Utah',        sub: 'Ogden, Logan, Cache Valley' },
  { id: 'park_city_heber',  title: 'Park City / Heber',   sub: 'Summit and Wasatch counties' },
  { id: 'southern_utah',    title: 'Southern Utah',        sub: 'St. George, Cedar City area' },
  { id: 'central_utah',     title: 'Central Utah',         sub: 'Richfield, Nephi, Manti' },
  { id: 'eastern_utah',     title: 'Eastern Utah',         sub: 'Price, Moab, San Juan' },
  { id: 'uinta_basin',      title: 'Uinta Basin',          sub: 'Vernal, Roosevelt, Duchesne' },
]

export const RESOURCE_TYPE_LABELS = {
  grant_program:        'Grant',
  vc_fund:              'VC Fund',
  angel_group:          'Angel Group',
  microloan_cdfi:       'Microloan',
  incubator_accelerator:'Accelerator',
  coworking_space:      'Coworking',
  makerspace:           'Makerspace',
  training_education:   'Training',
  university_center:    'University',
  government_program:   'Gov Program',
  industry_association: 'Association',
  chamber_econ_dev:     'Chamber',
  event:                'Event',
  legal_information:    'Legal / Info',
}

export const REGION_LABELS = {
  statewide:        'Statewide',
  salt_lake_metro:  'Salt Lake Metro',
  silicon_slopes:   'Silicon Slopes',
  northern_utah:    'Northern Utah',
  park_city_heber:  'Park City / Heber',
  southern_utah:    'Southern Utah',
  central_utah:     'Central Utah',
  eastern_utah:     'Eastern Utah',
  uinta_basin:      'Uinta Basin',
}

// ---- read ----

export async function getResources() {
  return resourcesLocal
}

export async function getResourceById(id) {
  return resourcesLocal.find(r => String(r.id) === String(id)) ?? null
}

// ---- score ----

export async function scoreQuiz({ stage, industry, topic, region }) {
  const all = await getResources()
  const pool = all.filter(r => !r.needs_review)

  const allSkipped = !stage && !industry && !topic && !region
  if (allSkipped) {
    return [...pool].sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ ...r, score: 0 }))
  }

  const scored = pool.map(r => {
    let score = 0

    if (industry && (r.tags.industry.includes('general') || r.tags.industry.includes(industry))) score += 100

    if (topic && (r.tags.goal.includes('any') || r.tags.goal.includes(topic))) score += 80

    if (stage) {
      if (r.tags.stage.includes('any') || r.tags.stage.includes(stage)) score += 40
    }

    if (region) {
      if (r.tags.region.includes('statewide') || r.tags.region.includes(region)) score += 20
    }

    if (r.tags.resource_type.includes('grant_program') || r.tags.resource_type.includes('microloan_cdfi')) {
      score += 5
    }

    return { ...r, score }
  })

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return scored
}

// ---- write ----

export async function submitProfile(payload) {
  if (supabase) {
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
