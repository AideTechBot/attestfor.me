import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { NotFoundContent } from "./NotFoundPage";

interface ProfileData {
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  isValid: boolean;
}

/**
 * Determine the base URL for server API calls.
 * During SSR (Node.js), we need an absolute URL pointing to our own server.
 * During client-side navigation (browser), relative URLs work fine.
 */
function getApiBase(request?: Request): string {
  // Client-side: use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }
  // SSR: derive from the incoming request or use env/fallback
  if (request) {
    const url = new URL(request.url);
    return url.origin;
  }
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function profileLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<ProfileData> {
  const handle = params.handle;

  if (!handle) {
    return { handle: "", isValid: false };
  }

  // Remove @ prefix if present (handle comes from URL like /@manoo.dev)
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Skip requests for static files that hit the /:handle route (e.g. favicon.ico)
  if (
    /\.(ico|png|jpg|jpeg|svg|webp|gif|js|css|map|json|txt|xml|webmanifest)$/i.test(
      cleanHandle,
    )
  ) {
    return { handle: cleanHandle, isValid: false };
  }

  try {
    const apiBase = getApiBase(request);
    const res = await fetch(
      `${apiBase}/api/atproto/profile?actor=${encodeURIComponent(cleanHandle)}`,
    );

    if (!res.ok) {
      return { handle: cleanHandle, isValid: false };
    }

    const data = (await res.json()) as {
      handle: string;
      displayName?: string;
      description?: string;
      avatar?: string;
    };

    return {
      handle: data.handle,
      displayName: data.displayName,
      description: data.description,
      avatar: data.avatar,
      isValid: true,
    };
  } catch (error) {
    console.error("[ProfileLoader] Error fetching profile:", error);
    return { handle: cleanHandle, isValid: false };
  }
}

export function ProfilePage() {
  const profile = useLoaderData() as ProfileData;

  if (!profile.isValid) {
    return <NotFoundContent />;
  }

  return (
    <>
      {/* Profile Section */}
      <div className="flex flex-col items-center gap-6">
        {/* Profile Picture */}
        {profile.avatar ? (
          <img
            src={`${profile.avatar}&size=thumbnail`}
            alt={profile.displayName || profile.handle}
            className="w-30 h-30 object-cover shadow-lg shadow-accent-subtle"
          />
        ) : (
          <div className="w-30 h-30 bg-accent flex items-center justify-center text-4xl text-white font-bold shadow-lg shadow-accent-subtle">
            {profile.handle[0].toUpperCase()}
          </div>
        )}

        {/* Profile Info */}
        <div className="text-center">
          <h1 className="text-2xl m-0 mb-3">
            {profile.displayName || `@${profile.handle}`}
          </h1>
          {profile.displayName && (
            <div className="text-sm text-muted m-0 mb-3">@{profile.handle}</div>
          )}
          {profile.description && (
            <div className="text-sm leading-relaxed text-muted m-0">
              {profile.description}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
