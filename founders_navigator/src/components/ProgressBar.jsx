export default function ProgressBar({ step, total }) {
  return (
    <div className="progress-bar">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`progress-dot ${i <= step ? 'active' : ''}`} />
      ))}
    </div>
  )
}
