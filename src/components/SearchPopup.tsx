import { X, Loader2 } from "lucide-react";
import type { AtprotoActor } from "@/lib/use-atproto-search";
import { thumbnailAvatar } from "@/lib/bsky";
import { SEARCH, NAV } from "@/lib/ui-strings";

interface SearchPopupProps {
  visible: boolean;
  searchValue: string;
  recentSearches: string[];
  suggestions: AtprotoActor[];
  suggestionsLoading: boolean;
  followSuggestions: AtprotoActor[];
  onSelect: (handle: string) => void;
  onRemove: (handle: string) => void;
  onClearAll: () => void;
}

export function SearchPopup({
  visible,
  searchValue,
  recentSearches,
  suggestions,
  suggestionsLoading,
  followSuggestions,
  onSelect,
  onRemove,
  onClearAll,
}: SearchPopupProps) {
  if (!visible) {
    return null;
  }

  const trimmed = searchValue.trim();
  const cleanQuery = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  // Filter recent searches by current query
  const filtered = cleanQuery
    ? recentSearches.filter((h) =>
        h.toLowerCase().includes(cleanQuery.toLowerCase()),
      )
    : recentSearches;

  const showGoTo = cleanQuery.length > 0;
  const showSuggestions =
    cleanQuery.length > 0 && (suggestions.length > 0 || suggestionsLoading);
  const showFollowSuggestions =
    cleanQuery.length === 0 && followSuggestions.length > 0;
  const showRecent = filtered.length > 0;

  if (!showGoTo && !showRecent && !showFollowSuggestions) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-surface-border shadow-lg overflow-hidden">
      {/* Go to handle */}
      {showGoTo && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(cleanQuery)}
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
        >
          <span className="text-muted">{SEARCH.goTo}</span>
          <span className="font-medium">@{cleanQuery}</span>
        </button>
      )}

      {/* AT Protocol suggestions */}
      {showSuggestions && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-surface-border">
            <span className="text-xs text-muted">{SEARCH.suggestions}</span>
            {suggestionsLoading && (
              <Loader2 className="w-3 h-3 text-muted animate-spin" />
            )}
          </div>
          {suggestions.map((actor) => (
            <button
              key={actor.handle}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(actor.handle)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              {actor.avatar ? (
                <img
                  src={thumbnailAvatar(actor.avatar)}
                  alt=""
                  className="w-6 h-6 object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 bg-accent/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {actor.handle[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {actor.displayName && (
                  <span className="text-sm font-medium truncate leading-tight">
                    {actor.displayName}
                  </span>
                )}
                <span className="text-xs text-muted truncate leading-tight group-hover:text-inherit">
                  @{actor.handle}
                </span>
              </div>
            </button>
          ))}
        </>
      )}

      {/* Follow suggestions (shown when idle & logged in) */}
      {showFollowSuggestions && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-surface-border first:border-t-0">
            <span className="text-xs text-muted">{SEARCH.fromFollowers}</span>
          </div>
          {followSuggestions.map((actor) => (
            <button
              key={actor.handle}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(actor.handle)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              {actor.avatar ? (
                <img
                  src={thumbnailAvatar(actor.avatar)}
                  alt=""
                  className="w-6 h-6 object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 bg-accent/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {actor.handle[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {actor.displayName && (
                  <span className="text-sm font-medium truncate leading-tight">
                    {actor.displayName}
                  </span>
                )}
                <span className="text-xs text-muted truncate leading-tight">
                  @{actor.handle}
                </span>
              </div>
            </button>
          ))}
        </>
      )}

      {/* Recent searches */}
      {showRecent && (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface-border">
            <span className="text-xs text-muted">{SEARCH.recent}</span>
            {!cleanQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearAll}
                className="text-xs text-muted hover:text-accent transition-colors cursor-pointer"
              >
                {NAV.clearAll}
              </button>
            )}
          </div>
          {filtered.map((handle) => (
            <div
              key={handle}
              className="flex items-center hover:bg-accent hover:text-white transition-colors group"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(handle)}
                className="flex-1 px-3 py-2 text-left text-sm cursor-pointer"
              >
                @{handle}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(handle)}
                className="px-2 py-2 text-muted hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                aria-label={SEARCH.removeRecent(handle)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
