import { useState } from 'react'
import QuizStep from '../components/QuizStep'
import ProgressBar from '../components/ProgressBar'
import { getResults } from '../lib/scoring'

const STEPS = [
  {
    key: 'stage',
    question: 'What stage is your startup?',
    multiSelect: false,
    options: [
      { value: 'idea', label: 'Just an idea' },
      { value: 'early_stage', label: 'Early stage' },
      { value: 'growth', label: 'Scaling' },
    ],
  },
  {
    key: 'industry',
    question: 'What industry are you in?',
    multiSelect: false,
    options: [
      { value: 'tech_software', label: 'Software / Tech' },
      { value: 'life_sciences', label: 'Healthcare / Life Sciences' },
      { value: 'agriculture_food', label: 'Agriculture & Food' },
      { value: 'consumer_brands', label: 'Consumer Goods & Retail' },
      { value: 'manufacturing', label: 'Manufacturing' },
      { value: 'hospitality_tourism', label: 'Hospitality & Tourism' },
      { value: 'arts_media', label: 'Arts & Media' },
      { value: 'aerospace_defense', label: 'Aerospace & Defense' },
      { value: 'general', label: 'Other' },
    ],
  },
  {
    key: 'goal',
    question: 'What are your top goals?',
    multiSelect: true,
    options: [
      { value: 'raise_capital', label: 'Raise funding' },
      { value: 'start_business', label: 'Start my business' },
      { value: 'validate_idea', label: 'Validate my idea' },
      { value: 'hire_workforce', label: 'Hire & build a team' },
      { value: 'grow_sales_marketing', label: 'Grow sales & marketing' },
      { value: 'network_community', label: 'Find community & mentors' },
      { value: 'find_workspace', label: 'Find a workspace' },
      { value: 'government_contracting', label: 'Government contracting' },
      { value: 'export_internationally', label: 'Export internationally' },
    ],
  },
  {
    key: 'region',
    question: 'Where are you located in Utah?',
    multiSelect: false,
    options: [
      { value: 'salt_lake_metro', label: 'Salt Lake Metro' },
      { value: 'silicon_slopes', label: 'Silicon Slopes (Lehi/Provo)' },
      { value: 'northern_utah', label: 'Northern Utah (Ogden/Logan)' },
      { value: 'park_city_heber', label: 'Park City / Heber' },
      { value: 'southern_utah', label: 'Southern Utah (St. George)' },
      { value: 'central_utah', label: 'Central Utah' },
      { value: 'eastern_utah', label: 'Eastern Utah' },
      { value: 'uinta_basin', label: 'Uinta Basin' },
    ],
  },
]

const INITIAL_ANSWERS = { stage: null, industry: null, goal: [], region: null }

export default function Quiz({ onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(INITIAL_ANSWERS)

  const current = STEPS[step]

  function handleChange(value) {
    setAnswers(prev => ({ ...prev, [current.key]: value }))
  }

  function advance() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      onComplete(getResults(answers))
    }
  }

  function handleNext() {
    advance()
  }

  function handleSkip() {
    setAnswers(prev => ({
      ...prev,
      [current.key]: current.multiSelect ? [] : null,
    }))
    advance()
  }

  return (
    <div className="quiz-container">
      <ProgressBar step={step} total={STEPS.length} />
      <QuizStep
        question={current.question}
        options={current.options}
        multiSelect={current.multiSelect}
        value={answers[current.key]}
        onChange={handleChange}
        onNext={handleNext}
        onSkip={handleSkip}
      />
    </div>
  )
}
