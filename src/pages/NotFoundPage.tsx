import { Link } from "react-router";

export function NotFoundContent() {
  return (
    <div className="flex-1 w-full flex flex-col items-center text-center">
      <h1 className="text-7xl font-bold text-accent m-0 mb-2">404</h1>
      <p className="text-lg text-muted m-0 mb-8">Page not found</p>
      <Link
        to="/"
        className="text-accent hover:text-accent-hover transition-colors"
      >
        ← Back to Home
      </Link>
    </div>
  );
}

export function NotFoundPage() {
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
      <div className="flex-1 border border-surface-border p-6">
        <NotFoundContent />
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
