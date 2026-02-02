import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useParams } from "react-router";
import { NotFoundContent } from "./NotFoundPage";

const VALID_IDS = ["john"];

// TODO: replace this
// eslint-disable-next-line react-refresh/only-export-components
export function profileLoader({ params }: LoaderFunctionArgs) {
  const isValid = VALID_IDS.includes(params.id ?? "");
  return { isValid };
}

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { isValid } = useLoaderData() as { isValid: boolean };

  if (!isValid) {
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

  return (
    <div className="w-[400px] max-w-full min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header with User Icon and Search */}
      <header className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-surface border border-surface-border flex items-center justify-center text-muted text-xs shrink-0">
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
        {/* Profile Section */}
        <div className="flex flex-col items-center gap-6">
          {/* Profile Picture */}
          <div className="w-30 h-30 bg-accent flex items-center justify-center text-4xl text-white font-bold shadow-lg shadow-accent-subtle">
            {id?.[0].toUpperCase()}
          </div>

          {/* Profile Info */}
          <div className="text-center">
            <h1 className="text-2xl m-0 mb-3">{id}</h1>
            <p className="text-sm leading-relaxed text-muted m-0">
              This is the profile description for {id}. Here you can add
              information about this user, their interests, achievements, and
              anything else you'd like to share.
            </p>
          </div>
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
