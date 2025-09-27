export default function NavBar() {
  return (
    <nav className="backdrop-blur-sm shadow-sm sticky top-0 z-50 bg-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-accent">Milan</h1>
          </div>
          <div className="flex items-center space-x-4">
            <a href="#hero" className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-on-dark">Home</a>
          </div>
        </div>
      </div>
    </nav>
  )
}


