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

// eslint-disable-next-line react-refresh/only-export-components
export async function profileLoader({
  params,
}: LoaderFunctionArgs): Promise<ProfileData> {
  const handle = params.handle;
  console.log("[ProfileLoader] Received handle param:", handle);

  if (!handle) {
    console.log("[ProfileLoader] No handle provided");
    return { handle: "", isValid: false };
  }

  // Remove @ prefix if present (handle comes from URL like /@manoo.dev)
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  console.log("[ProfileLoader] Clean handle:", cleanHandle);

  try {
    // Fetch profile from Bluesky API
    const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${cleanHandle}`;
    console.log("[ProfileLoader] Fetching from:", url);

    const response = await fetch(url);

    if (!response.ok) {
      console.log(
        "[ProfileLoader] API response not OK:",
        response.status,
        response.statusText,
      );
      return { handle: cleanHandle, isValid: false };
    }

    const data = await response.json();
    console.log("[ProfileLoader] Success! Got profile for:", data.handle);

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
            src={profile.avatar}
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
