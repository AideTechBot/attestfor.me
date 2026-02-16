import { useState, useEffect, useRef } from "react";
import { getFollows } from "./bsky";

import type { AtprotoActor } from "./use-atproto-search";

const PICK_COUNT = 5;
const FOLLOWERS_FETCH_LIMIT = 50;

/**
 * Fetches follows for the given handle via the Bluesky public API,
 * then picks `PICK_COUNT` random ones. Results are cached so that
 * re-focusing the search bar doesn't re-fetch or re-shuffle.
 */
export function useRandomFollowers(handle: string | undefined) {
  const [followers, setFollowers] = useState<AtprotoActor[]>([]);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!handle || fetchedForRef.current === handle) {
      return;
    }

    // Mark immediately so we don't double-fetch
    fetchedForRef.current = handle;

    const controller = new AbortController();

    getFollows(handle, FOLLOWERS_FETCH_LIMIT, controller.signal)
      .then((all) => {
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
