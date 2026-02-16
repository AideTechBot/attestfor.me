import { useQuery } from "@tanstack/react-query";
import { getProfile, resolveHandle } from "./bsky";
import type { BskyProfile } from "./bsky";

/**
 * Fetch a profile via the Bluesky public API.
 */
export function useProfile(actor: string | undefined) {
  return useQuery<BskyProfile | null>({
    queryKey: ["profile", actor],
    queryFn: () => getProfile(actor!),
    enabled: !!actor,
  });
}

/**
 * Resolve a handle to a DID via the Bluesky public API.
 */
export function useResolveHandle(handle: string | undefined) {
  return useQuery<string | null>({
    queryKey: ["resolveHandle", handle],
    queryFn: () => resolveHandle(handle!),
    enabled: !!handle,
  });
}
