import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'

export default function UniversityAppPage() {
  return (
    <div className="min-h-screen py-16 relative z-10">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link to="/" className="text-accent hover:opacity-80">← Back to Home</Link>
        </div>

        <h1 className="text-4xl font-bold mb-6 text-on-dark">University App</h1>
        <p className="text-lg leading-relaxed text-muted-on-dark mb-6">
          This page will showcase details about the University Management System project: goals, features,
          tech stack, screenshots, and a link to the repository or live demo.
        </p>

        <div className="space-y-4 text-on-dark">
          <h2 className="text-2xl font-semibold">Highlights</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Project overview and problem statement</li>
            <li>Key features and user flows</li>
            <li>Tech stack and architecture</li>
            <li>Learnings and outcomes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


