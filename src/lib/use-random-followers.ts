import { useState, useEffect, useRef } from "react";
import type { BlueskyActor } from "./use-bluesky-search";

const PICK_COUNT = 5;
const FOLLOWERS_FETCH_LIMIT = 50; // Fetch a decent pool to randomize from

/**
 * Fetches followers for the given handle from the public Bluesky API,
 * then picks `PICK_COUNT` random ones. Results are cached so that
 * re-focusing the search bar doesn't re-fetch or re-shuffle.
 */
export function useRandomFollowers(handle: string | undefined) {
  const [followers, setFollowers] = useState<BlueskyActor[]>([]);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!handle || fetchedForRef.current === handle) {
      return;
    }

    // Mark immediately so we don't double-fetch
    fetchedForRef.current = handle;

    const controller = new AbortController();

    fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.graph.getFollowers?actor=${encodeURIComponent(handle)}&limit=${FOLLOWERS_FETCH_LIMIT}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Followers fetch failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const all: BlueskyActor[] = (data.followers ?? []).map(
          (f: { handle: string; displayName?: string; avatar?: string }) => ({
            handle: f.handle,
            displayName: f.displayName,
            avatar: f.avatar,
          }),
        );

        // Shuffle and pick random subset
        const shuffled = all.sort(() => Math.random() - 0.5);
        setFollowers(shuffled.slice(0, PICK_COUNT));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setFollowers([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [handle]);

  return followers;
}
