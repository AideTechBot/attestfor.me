import { useState, type ReactNode } from "react";
import { User, ExternalLink, X } from "lucide-react";
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

// TODO: Replace with actual auth state
const IS_LOGGED_IN = true;

export function PageLayout({ children }: PageLayoutProps) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="w-full max-w-[400px] min-w-[400px] min-h-screen mx-auto px-6 py-8 flex flex-col">
      {/* Header with User Icon and Search */}
      <header className="flex items-center gap-3 mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "w-8 h-8 min-h-8 bg-surface border border-surface-border box-border",
              "flex items-center justify-center text-muted text-xs shrink-0 leading-none",
              "hover:border-accent transition-colors cursor-pointer outline-none",
              "data-[state=open]:border-accent",
            )}
          >
            <User className="w-5 h-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={4}
            className="bg-surface border-surface-border shadow-lg p-0 min-w-32 rounded-none text-inherit"
          >
            {!IS_LOGGED_IN ? (
              <DropdownMenuItem
                className="px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white"
                onSelect={() => {
                  // TODO: Implement sign in
                }}
              >
                Sign in
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  className="whitespace-nowrap px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white"
                  onSelect={() => {
                    // TODO: Navigate to profile
                  }}
                >
                  <span>Visit profile</span>
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="px-4 py-2 rounded-none hover:bg-accent hover:text-white focus:bg-accent focus:text-white"
                  onSelect={() => {
                    // TODO: Implement sign out
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-8"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
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
