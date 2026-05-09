import { useState } from 'react'
import Landing from './pages/Landing'
import Quiz from './pages/Quiz'

export default function App() {
  const [view, setView] = useState('landing')
  const [scoredResults, setScoredResults] = useState([])

  function handleQuizComplete(results) {
    setScoredResults(results)
    setView('results')
  }

  function handleRetake() {
    setScoredResults([])
    setView('landing')
  }

  if (view === 'landing') return <Landing onStart={() => setView('quiz')} />
  if (view === 'quiz') return <Quiz onComplete={handleQuizComplete} />
  if (view === 'results') return <div><p>Results coming soon</p><button onClick={handleRetake}>Retake Quiz</button></div>
}
