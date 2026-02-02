export function HomePage() {
  return (
    <div className="w-[400px] max-w-full min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header with User Icon and Search */}
      <header className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-surface border border-surface-border box-border flex items-center justify-center text-muted text-xs shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search..."
          className="flex-1 h-8 px-3 border border-surface-border box-border bg-input text-inherit outline-none text-sm placeholder:text-muted"
        />
      </header>

      {/* Main Content */}
      <div className="flex-1 border border-surface-border p-6">
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
      </div>

      {/* Footer */}
      <footer className="mt-3 flex justify-center gap-4 text-xs text-muted">
        <a
          href="https://bsky.app/profile/manoo.dev"
          className="hover:text-accent transition-colors"
        >
          made by manoo
        </a>
        <span>·</span>
        <a
          href="https://bsky.app/profile/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          bluesky
        </a>
        <span>·</span>
        <a
          href="https://github.com/AideTechBot/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          github
        </a>
        <span>·</span>
        <a
          href="https://tangled.com/repo/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          tangled
        </a>
      </footer>
    </div>
  );
}
