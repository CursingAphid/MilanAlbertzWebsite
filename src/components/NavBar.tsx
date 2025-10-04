import { Link } from 'react-router-dom'

export default function NavBar() {
  return (
    <nav className="backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-50 bg-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-accent hover:opacity-80 transition-opacity">
              Milan
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-on-dark hover:text-accent">
              Home
            </Link>
            <Link to="/university-app" className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-on-dark hover:text-accent">
              University Project
            </Link>
            <Link to="/cgi-projects" className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-on-dark hover:text-accent">
              CGI Projects
            </Link>
            <Link to="/hobby-projects" className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-on-dark hover:text-accent">
              Hobby Projects
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}


