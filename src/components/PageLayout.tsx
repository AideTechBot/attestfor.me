import { useState, useEffect, type ReactNode } from "react";
import { User, ExternalLink, X } from "lucide-react";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
}

interface SessionData {
  authenticated: boolean;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export function PageLayout({ children }: PageLayoutProps) {
  const [searchValue, setSearchValue] = useState("");
  const [loginHandle, setLoginHandle] = useState("");
  const [showLoginInput, setShowLoginInput] = useState(false);
  const navigate = useNavigate();

  // Start with no session to match SSR
  const [session, setSession] = useState<SessionData>({ authenticated: false });

  useEffect(() => {
    // Fetch session data from server (session stored in secure HttpOnly cookie)
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false }));
  }, []);

  const handleLogin = () => {
    if (!loginHandle.trim()) return;
    window.location.href = `/api/auth/login?handle=${encodeURIComponent(loginHandle)}`;
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      // Add @ prefix if not present
      const handle = searchValue.startsWith("@")
        ? searchValue
        : `@${searchValue}`;
      navigate(`/${handle}`);
      setSearchValue("");
    }
  };

  return (
    <div className="w-full max-w-[400px] min-w-[400px] min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header with User Icon and Search */}
      <header className="flex items-center gap-3 mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "w-8 h-8 min-h-8 bg-surface border border-surface-border box-border",
              "flex items-center justify-center text-muted text-xs shrink-0 leading-none overflow-hidden",
              "hover:border-accent transition-colors cursor-pointer outline-none",
              "data-[state=open]:border-accent",
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
            align="start"
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
                        if (e.key === "Enter") handleLogin();
                        if (e.key === "Escape") setShowLoginInput(false);
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
                <DropdownMenuItem
                  className="whitespace-nowrap px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white"
                  onSelect={() => {
                    navigate(`/@${session.handle}`);
                  }}
                >
                  <span>Visit profile</span>
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white"
                  onSelect={handleLogout}
                >
                  Sign out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-8"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </header>

      {/* Main Content */}
      <div className="flex-1 border border-surface-border p-6">{children}</div>

      {/* Footer */}
      <footer className="mt-3 flex justify-center gap-4 text-xs text-muted">
        <a
          href="https://bsky.app/profile/manoo.dev"
          className="hover:text-accent transition-colors"
        >
          made by manoo
        </a>
        <span>·</span>
        <a
          href="https://bsky.app/profile/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          bluesky
        </a>
        <span>·</span>
        <a
          href="https://github.com/AideTechBot/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          github
        </a>
        <span>·</span>
        <a
          href="https://tangled.com/repo/attestfor.me"
          className="hover:text-accent transition-colors"
        >
          tangled
        </a>
      </footer>
    </div>
  );
}
