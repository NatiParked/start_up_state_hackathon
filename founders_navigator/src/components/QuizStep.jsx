export default function QuizStep({ question, options, multiSelect, value, onChange, onNext, onSkip }) {
  function handleSingleSelect(optionValue) {
    onChange(optionValue)
  }

  function handleMultiSelect(optionValue) {
    const current = value || []
    if (current.includes(optionValue)) {
      onChange(current.filter(v => v !== optionValue))
    } else if (current.length < 2) {
      onChange([...current, optionValue])
    }
  }

  function isSelected(optionValue) {
    if (multiSelect) return (value || []).includes(optionValue)
    return value === optionValue
  }

  const canProceed = multiSelect ? (value || []).length > 0 : value !== null && value !== undefined

  return (
    <div className="quiz-step">
      <h2 className="quiz-question">{question}</h2>
      {multiSelect && <p className="quiz-hint">Select up to 2</p>}

      <div className={`quiz-options ${multiSelect ? 'multi' : 'single'}`}>
        {options.map(opt => (
          <button
            key={opt.value}
            className={`option-btn ${isSelected(opt.value) ? 'selected' : ''}`}
            onClick={() => multiSelect ? handleMultiSelect(opt.value) : handleSingleSelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="quiz-actions">
        <button className="btn-skip" onClick={onSkip}>Skip</button>
        <button className="btn-next" onClick={onNext} disabled={!canProceed}>
          Next
        </button>
      </div>
    </div>
  )
}
