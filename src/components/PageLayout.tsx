import { useState, useEffect, useRef, type ReactNode } from "react";
import { User, ExternalLink, X } from "lucide-react";
import { useNavigate, useLocation, Link, Outlet } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
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
  "px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white";

const FOOTER_LINKS = [
  { href: "https://bsky.app/profile/manoo.dev", label: "made by manoo" },
  { href: "https://bsky.app/profile/attestfor.me", label: "bluesky" },
  { href: "https://github.com/AideTechBot/attestfor.me", label: "github" },
  { href: "https://tangled.com/repo/attestfor.me", label: "tangled" },
] as const;


export function PageLayout({ children }: PageLayoutProps) {
  const [searchValue, setSearchValue] = useState("");
  const [loginHandle, setLoginHandle] = useState("");
  const [showLoginInput, setShowLoginInput] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [session, setSession] = useState<SessionData>({ authenticated: false });
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === "/" || location.pathname === "/home";
  const isOwnProfile = location.pathname === `/@${session.handle}`;


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

  // Measure logo/avatar widths and set CSS custom properties on the header
  useEffect(() => {
    const header = headerRef.current;
    if (!header) {return;}

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
    if (logoRef.current) {ro.observe(logoRef.current);}
    if (avatarRef.current) {ro.observe(avatarRef.current);}
    return () => ro.disconnect();
  }, [isHomePage]);


  const handleLogin = () => {
    if (!loginHandle.trim()) {return;}
    window.location.href = `/api/auth/login?handle=${encodeURIComponent(loginHandle)}`;
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) {return;}
    const handle = searchValue.startsWith("@") ? searchValue : `@${searchValue}`;
    navigate(`/${handle}`);
    setSearchValue("");
  };

  const clearSearch = () => {
    setSearchValue("");
    inputRef.current?.focus();
  };


  return (
    <div className="w-full max-w-[400px] min-w-[400px] min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header */}
      <header ref={headerRef} className="flex items-center mb-3 relative h-8">
        {/* Logo: always rendered, animated in/out based on route */}
        <span
          ref={logoRef}
          className={cn(
            "overflow-hidden whitespace-nowrap search-anim-child",
            isHomePage ? "max-w-0 opacity-0 mr-0" : "max-w-[10rem] opacity-100 mr-2",
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn("pr-8 w-full h-full search-input", searchFocused && "search-active")}
            />
            {searchValue && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Spacer: pushes avatar to the right when form is absolutely positioned */}
        <div className="search-spacer" />

        {/* User menu */}
        <div ref={avatarRef} className="ml-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "w-8 h-8 min-h-8 bg-surface border border-surface-border box-border",
                "flex items-center justify-center text-muted text-xs shrink-0 leading-none overflow-hidden",
                "hover:border-accent transition-colors cursor-pointer outline-none",
                "data-[state=open]:border-accent",
                "search-anim-child",
                searchFocused && "opacity-0 pointer-events-none",
                !sessionLoaded && "invisible",
              )}
            >
              {session.authenticated && session.avatar ? (
                <img
                  src={session.avatar}
                  alt={session.displayName || session.handle}
                  className="w-full h-full object-cover"
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
                      className="w-full px-4 py-2 text-left hover:bg-accent hover:text-white focus:bg-accent focus:text-white transition-colors"
                    >
                      Sign in
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="your-handle.bsky.social"
                        value={loginHandle}
                        onChange={(e) => setLoginHandle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {handleLogin();}
                          if (e.key === "Escape") {setShowLoginInput(false);}
                        }}
                        className="w-full px-3 py-2 bg-input border border-surface-border text-inherit text-sm outline-none focus:border-accent"
                        autoFocus
                      />
                      <button
                        onClick={handleLogin}
                        className="w-full px-4 py-2 bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                      >
                        Continue
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
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={handleLogout}>
                    Sign out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 border border-surface-border p-6">{children ?? <Outlet />}</div>

      {/* Footer */}
      <footer className="mt-3 flex justify-center gap-4 text-xs text-muted">
        {FOOTER_LINKS.map((link, i) => (
          <span key={link.href} className="contents">
            {i > 0 && <span>·</span>}
            <a href={link.href} className="hover:text-accent transition-colors">
              {link.label}
            </a>
          </span>
        ))}
      </footer>
    </div>
  );
}
