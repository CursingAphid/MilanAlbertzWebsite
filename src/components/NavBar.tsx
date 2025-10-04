import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <nav className="backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-50 bg-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-accent hover:opacity-80 transition-opacity">
              Milan
            </Link>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-4">
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
          {/* Mobile hamburger */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-md p-2 text-on-dark hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden pb-3">
            <div className="space-y-1 pt-2">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium transition-colors text-on-dark hover:text-accent"
              >
                Home
              </Link>
              <Link
                to="/university-app"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium transition-colors text-on-dark hover:text-accent"
              >
                University Project
              </Link>
              <Link
                to="/cgi-projects"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium transition-colors text-on-dark hover:text-accent"
              >
                CGI Projects
              </Link>
              <Link
                to="/hobby-projects"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium transition-colors text-on-dark hover:text-accent"
              >
                Hobby Projects
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}


