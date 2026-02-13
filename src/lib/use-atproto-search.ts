import { useState, useEffect, useRef } from "react";

export interface AtprotoActor {
  handle: string;
  displayName?: string;
  avatar?: string;
}

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

      fetch(
        `/api/atproto/search?q=${encodeURIComponent(trimmed)}&limit=${SEARCH_LIMIT}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Search failed: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          const actors: AtprotoActor[] = (data.actors ?? []).map(
            (a: { handle: string; displayName?: string; avatar?: string }) => ({
              handle: a.handle,
              displayName: a.displayName,
              avatar: a.avatar,
            }),
          );
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
