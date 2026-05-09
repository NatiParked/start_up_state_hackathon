export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <h1>Founder's Navigator</h1>
      <p>Answer 4 quick questions and we'll match you to the best Utah startup resources — in under 2 minutes.</p>
      <button className="btn-primary" onClick={onStart}>Find My Resources</button>
    </div>
  )
}
