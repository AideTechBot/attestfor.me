export function HomePage() {
  return (
    <div className="w-[400px] max-w-full min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Centered Logo and Tagline */}
      <div className="text-center mb-8 shrink-0">
        <h1 className="text-5xl font-bold text-accent m-0 mb-2">
          ATtest for me!
        </h1>
        <p className="text-xl text-muted m-0">Your tagline goes here</p>
      </div>

      {/* Explanation */}
      <div className="mb-8">
        <h2 className="text-center mb-3 text-lg">What is this?</h2>
        <p className="text-center leading-relaxed text-muted text-sm m-0">
          This is a platform where you can search for and discover amazing
          things. Our service helps you find exactly what you're looking for
          with powerful search capabilities and a clean, modern interface.
        </p>
      </div>

      {/* Login Button */}
      <div className="mb-6">
        <button className="w-full px-3 py-2 border border-accent bg-transparent text-accent text-sm font-medium transition-all hover:bg-accent hover:text-white">
          Log in
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 border-t border-surface-border"></div>
        <span className="text-sm text-muted">or</span>
        <div className="flex-1 border-t border-surface-border"></div>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="text"
          placeholder="Search..."
          className="w-full px-3 py-2 border border-surface-border bg-input text-inherit outline-none text-sm placeholder:text-muted"
        />
      </div>
    </div>
  );
}
