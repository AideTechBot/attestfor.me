import { Link, Outlet } from "react-router";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { OfflineIndicator } from "./OfflineIndicator";
import { FOOTER_LINKS } from "./PageLayout";

export function SimplePageLayout() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="w-full max-w-[400px] min-w-[400px] min-h-screen mx-auto px-2 py-8 flex flex-col">
      {/* Main Content — no header, no border */}
      <main className="flex-1 flex flex-col p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-3 flex justify-center gap-4 text-xs text-muted">
        {FOOTER_LINKS.map((link, i) => (
          <span key={link.label} className="contents">
            {i > 0 && <span>·</span>}
            {"internal" in link && link.internal ? (
              <Link
                to={link.href}
                className="hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                href={link.href}
                className="hover:text-accent transition-colors"
              >
                {link.label}
              </a>
            )}
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
