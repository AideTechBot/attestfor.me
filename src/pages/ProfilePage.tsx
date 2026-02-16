import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AvatarWithShimmer } from "@/components/AvatarWithShimmer";
import { NotFoundContent } from "./NotFoundPage";
import { getProfile } from "@/lib/bsky";

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
    // Same code runs on both server (SSR) and client (navigation).
    // getProfile calls the Bluesky public API directly.
    const profile = await getProfile(cleanHandle);
    if (!profile) {
      return { handle: cleanHandle, isValid: false };
    }

    return {
      handle: profile.handle,
      displayName: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
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
          <AvatarWithShimmer
            key={profile.avatar}
            src={profile.avatar}
            alt={profile.displayName || profile.handle}
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
