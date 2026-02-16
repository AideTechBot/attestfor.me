import { useState, useEffect, useRef } from "react";
import { searchActors } from "./bsky";
import type { BskyActor } from "./bsky";

export type AtprotoActor = BskyActor;

const DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 5;

export function useAtprotoSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<AtprotoActor[]>([]);
  const [fetchedQuery, setFetchedQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = query.trim().replace(/^@/, "");
  const shouldSearch = enabled && trimmed.length >= 1;

  useEffect(() => {
    if (!shouldSearch) {
      return;
    }

    const timer = setTimeout(() => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      searchActors(trimmed, SEARCH_LIMIT, controller.signal)
        .then((actors) => {
          setResults(actors);
          setFetchedQuery(trimmed);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setResults([]);
            setFetchedQuery(trimmed);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [shouldSearch, trimmed]);

  if (!shouldSearch) {
    return { results: [], loading: false };
  }

  // Derive loading from whether we've fetched results for the current query
  const loading = fetchedQuery !== trimmed;

  return { results, loading };
}
