import resources from '../data/tagged_resources.json'

const DIVERSITY_TYPES = new Set(['grant_program', 'microloan_cdfi'])

function scoreResource(resource, answers) {
  const { stage, industry, goal, region } = answers
  const t = resource.tags
  let score = 0

  if (industry && t.industry === industry) score += 100

  if (goal && goal.length > 0) {
    const goalTags = Array.isArray(t.goal) ? t.goal : [t.goal]
    for (const g of goal) {
      if (goalTags.includes(g)) score += 80
    }
  }

  if (stage && (t.stage === stage || t.stage === 'any')) score += 40

  if (region && (t.region === region || t.region === 'statewide')) score += 20

  const types = Array.isArray(t.resource_type) ? t.resource_type : [t.resource_type]
  if (types.some(rt => DIVERSITY_TYPES.has(rt))) score += 5

  return score
}

export function getResults(answers) {
  const eligible = resources.filter(r => !r.needs_review)

  const allSkipped = !answers.stage && !answers.industry &&
    (!answers.goal || answers.goal.length === 0) && !answers.region

  if (allSkipped) {
    return [...eligible].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 15)
  }

  return eligible
    .map(r => ({ ...r, score: scoreResource(r, answers) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 15)
}
