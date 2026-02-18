import { useState, useEffect, useRef, type ReactNode } from "react";
import { User, ExternalLink, X } from "lucide-react";
import { useNavigate, useLocation, Link, Outlet } from "react-router";
import { Toaster } from "sonner";
import { checkAuthErrorParams } from "@/lib/error-handler";
import { OfflineIndicator } from "./OfflineIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
} from "@/lib/recent-searches";
import { SearchPopup } from "./SearchPopup";
import { HeaderAvatar } from "./HeaderAvatar";
import { useSessionHint } from "@/lib/session-hint";
import { useAtprotoSearch } from "@/lib/use-atproto-search";
import { useRandomFollowers } from "@/lib/use-random-followers";
import { thumbnailAvatar } from "@/lib/bsky";
import "./search-animated.css";

interface PageLayoutProps {
  children?: ReactNode;
}

interface SessionData {
  authenticated: boolean;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

const LOGO_MARGIN = 8; // mr-2 = 8px
const AVATAR_MARGIN = 12; // ml-3 = 12px

const MENU_ITEM_CLASS =
  "px-4 py-3 sm:py-2 text-base sm:text-sm rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white";

const FOOTER_LINKS = [
  {
    href: "https://github.com/AideTechBot/attestfor.me",
    label: "made by manoo",
  },
  { href: "https://github.com/AideTechBot/attestfor.me", label: "github" },
  { href: "https://tangled.com/repo/attestfor.me", label: "tangled" },
] as const;

export function PageLayout({ children }: PageLayoutProps) {
  const [searchValue, setSearchValue] = useState("");
  const [loginHandle, setLoginHandle] = useState("");
  const [showLoginInput, setShowLoginInput] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [session, setSession] = useState<SessionData>({ authenticated: false });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { results: suggestions, loading: suggestionsLoading } =
    useAtprotoSearch(searchValue, searchFocused);

  const followSuggestions = useRandomFollowers(
    session.authenticated ? session.handle : undefined,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === "/" || location.pathname === "/home";
  const isOwnProfile = location.pathname === `/@${session.handle}`;

  // Check if user likely has a session (set via cookie, available during SSR)
  const maybeAuthenticated = useSessionHint();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setSession(data);
        setSessionLoaded(true);
      })
      .catch(() => {
        setSession({ authenticated: false });
        setSessionLoaded(true);
      });
  }, []);

  // If the user focused the input before hydration, React misses the focus event.
  // Sync state with the actual DOM focus on mount.
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchFocused(true);
    }
  }, []);

  // Measure logo/avatar widths and set CSS custom properties on the header
  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const update = () => {
      const logoW =
        !isHomePage && logoRef.current
          ? logoRef.current.scrollWidth + LOGO_MARGIN
          : 0;
      const avatarW = avatarRef.current
        ? avatarRef.current.offsetWidth + AVATAR_MARGIN
        : 44;
      header.style.setProperty("--search-left", `${logoW}px`);
      header.style.setProperty("--search-right", `${avatarW}px`);

      // Enable transitions after first measurement
      if (!header.classList.contains("search-ready")) {
        requestAnimationFrame(() => header.classList.add("search-ready"));
      }
    };

    update();

    const ro = new ResizeObserver(update);
    if (logoRef.current) {
      ro.observe(logoRef.current);
    }
    if (avatarRef.current) {
      ro.observe(avatarRef.current);
    }
    return () => ro.disconnect();
  }, [isHomePage]);

  // Mount the Toaster on first render
  useEffect(() => {
    // intentionally ignored
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Check for auth error params after Toaster has mounted
  useEffect(() => {
    if (mounted) {
      checkAuthErrorParams();
    }
  }, [mounted]);

  const handleLogin = () => {
    if (!loginHandle.trim()) {
      return;
    }
    setIsLoggingIn(true);
    const returnTo = encodeURIComponent(location.pathname);
    window.location.href = `/api/auth/login?handle=${encodeURIComponent(loginHandle)}&returnTo=${returnTo}`;
  };

  const handleLogout = () => {
    const returnTo = encodeURIComponent(location.pathname);
    window.location.href = `/api/auth/logout?returnTo=${returnTo}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) {
      return;
    }
    const clean = searchValue.startsWith("@")
      ? searchValue.slice(1)
      : searchValue;
    addRecentSearch(clean);
    setRecentSearches(getRecentSearches());
    navigate(`/@${clean}`);
    setSearchValue("");
    inputRef.current?.blur();
  };

  const handleSearchSelect = (handle: string) => {
    addRecentSearch(handle);
    setRecentSearches(getRecentSearches());
    navigate(`/@${handle}`);
    setSearchValue("");
    inputRef.current?.blur();
  };

  const handleRemoveRecent = (handle: string) => {
    removeRecentSearch(handle);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const clearSearch = () => {
    setSearchValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-[400px] min-w-[400px] min-h-screen mx-auto px-2 py-8 flex flex-col">
      {/* Header */}
      <header ref={headerRef} className="flex items-center mb-3 relative h-8">
        {/* Logo: always rendered, animated in/out based on route */}
        <span
          ref={logoRef}
          className={cn(
            "overflow-hidden whitespace-nowrap search-anim-child",
            isHomePage
              ? "max-w-0 opacity-0 mr-0"
              : "max-w-[10rem] opacity-100 mr-2",
            searchFocused && "!opacity-0 pointer-events-none",
          )}
        >
          <Link
            to="/"
            className="font-bold text-lg text-accent whitespace-nowrap"
            aria-label="Go to homepage"
            tabIndex={isHomePage ? -1 : 0}
          >
            attestfor.me
          </Link>
        </span>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className={cn(
            "search-form-base z-10",
            searchFocused
              ? "search-form-expanded"
              : isHomePage
                ? "search-form-resting-right"
                : "search-form-resting-left search-form-resting-right",
          )}
        >
          <div className="relative h-full">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                setRecentSearches(getRecentSearches());
              }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchValue("");
                  inputRef.current?.blur();
                }
              }}
              className={cn(
                "pr-8 w-full h-full search-input",
                searchFocused && "search-active",
              )}
            />
            {searchValue && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <SearchPopup
              visible={searchFocused}
              searchValue={searchValue}
              recentSearches={recentSearches}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              followSuggestions={followSuggestions}
              onSelect={handleSearchSelect}
              onRemove={handleRemoveRecent}
              onClearAll={handleClearAllRecent}
            />
          </div>
        </form>

        {/* Spacer: pushes avatar to the right when form is absolutely positioned */}
        <div className="search-spacer" />

        {/* User menu */}
        <div ref={avatarRef} className="ml-3">
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) {
                setShowLoginInput(false);
                setLoginHandle("");
              }
            }}
          >
            <DropdownMenuTrigger
              className={cn(
                "relative w-8 h-8 min-h-8 bg-surface border border-surface-border box-border",
                "flex items-center justify-center text-muted text-xs shrink-0 leading-none overflow-hidden",
                "hover:border-accent transition-colors cursor-pointer outline-none",
                "data-[state=open]:border-accent",
                "search-anim-child",
                searchFocused && "opacity-0 pointer-events-none",
              )}
            >
              {!sessionLoaded && maybeAuthenticated ? (
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 animate-pulse" />
              ) : session.authenticated && session.avatar ? (
                <HeaderAvatar
                  key={session.avatar}
                  src={thumbnailAvatar(session.avatar) || session.avatar}
                  alt={session.displayName || session.handle || ""}
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              className="bg-surface border-surface-border shadow-lg p-0 min-w-32 rounded-none text-inherit"
            >
              {!session.authenticated ? (
                <div className="p-2">
                  {!showLoginInput ? (
                    <button
                      onClick={() => setShowLoginInput(true)}
                      className="w-full px-4 py-3 sm:py-2 text-base sm:text-sm text-left hover:bg-accent hover:text-white focus:bg-accent focus:text-white transition-colors"
                    >
                      Sign in
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="your.handle.example"
                        value={loginHandle}
                        onChange={(e) => setLoginHandle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleLogin();
                          }
                          if (e.key === "Escape") {
                            setShowLoginInput(false);
                          }
                        }}
                        className="w-full px-3 py-3 sm:py-2 bg-input border border-surface-border text-inherit text-base sm:text-sm outline-none focus:border-accent"
                        autoComplete="username"
                        autoFocus
                      />
                      <button
                        onClick={handleLogin}
                        disabled={!loginHandle.trim() || isLoggingIn}
                        className="w-full px-4 py-3 sm:py-2 bg-accent text-white text-base sm:text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent flex items-center justify-center gap-2"
                      >
                        {isLoggingIn ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span>Signing in...</span>
                          </>
                        ) : (
                          "Continue"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {!isOwnProfile && (
                    <DropdownMenuItem
                      className={cn("whitespace-nowrap", MENU_ITEM_CLASS)}
                      onSelect={() => navigate(`/@${session.handle}`)}
                    >
                      <span>Visit profile</span>
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className={MENU_ITEM_CLASS}
                    onSelect={handleLogout}
                  >
                    Sign out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col border border-surface-border p-6">
        {children ?? <Outlet />}
      </div>

      {/* Footer */}
      <footer className="mt-3 flex justify-center gap-4 text-xs text-muted">
        {FOOTER_LINKS.map((link, i) => (
          <span key={link.label} className="contents">
            {i > 0 && <span>·</span>}
            <a href={link.href} className="hover:text-accent transition-colors">
              {link.label}
            </a>
          </span>
        ))}
      </footer>

      <OfflineIndicator />
      {mounted && (
        <Toaster
          position="bottom-center"
          closeButton
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "toast-base",
              error: "toast-error",
              success: "toast-success",
              warning: "toast-warning",
              info: "toast-info",
              title: "toast-title",
              description: "toast-description",
              actionButton: "toast-action",
              closeButton: "toast-close",
              icon: "toast-icon",
            },
          }}
        />
      )}
    </div>
  );
}
