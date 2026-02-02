import { Link } from "react-router";

export function NotFoundContent() {
  return (
    <div className="flex-1 w-full flex flex-col justify-center items-center text-center">
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
      <NotFoundContent />
    </div>
  );
}
