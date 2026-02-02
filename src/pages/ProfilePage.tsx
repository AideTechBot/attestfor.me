import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
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
        <NotFoundContent />
      </div>
    );
  }

  return (
    <div className="w-[400px] max-w-full min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header with Back Link */}
      <header className="flex justify-between items-center mb-8">
        <Link
          to="/"
          className="text-accent hover:text-accent-hover transition-colors"
        >
          ← Back to Home
        </Link>
      </header>

      {/* Profile Section */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
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
  );
}
