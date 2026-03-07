import { useState, useRef, useEffect } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceClaim } from "../../../types/keytrace";
import { SERVICE_NAMES } from "@/lib/global-features";
import { ServiceIcon } from "./ServiceIcon";
import { StatusBadge } from "./StatusBadge";
import { useVerification, type VerifyStatus } from "@/lib/verification-context";
import { runVerification } from "@/lib/run-verification";
import { serviceProviders } from "@keytrace/runner";
import { CLAIM_WARNING, NAV } from "@/lib/ui-strings";

interface SimpleClaimCardProps {
  claim: AtProtoRecord<DevKeytraceClaim.Main>;
}

function getTargetUrl(claim: DevKeytraceClaim.Main): string | undefined {
  // Use the runner's service provider to derive the profile URL from the claim URI
  const matches = serviceProviders.matchUri(claim.claimUri);
  if (matches.length > 0) {
    const match = matches[0];
    try {
      const config = match.provider.processURI(claim.claimUri, match.match);
      return config.profile.uri;
    } catch {
      // fall through
    }
  }

  // Fallback for known types
  switch (claim.type) {
    case "github":
      return `https://github.com/${claim.identity.subject}`;
    case "twitter":
      return `https://x.com/${claim.identity.subject.replace(/^@/, "")}`;
    default:
      return claim.identity.profileUrl;
  }
}

export function SimpleClaimCard({ claim }: SimpleClaimCardProps) {
  const { value } = claim;
  const { status, dispatch } = useVerification(claim.uri);
  const verifyStatus = status;
  const serviceName = SERVICE_NAMES[value.type] || value.type;
  const targetUrl = getTargetUrl(value);

  const handleVerify = () => {
    void runVerification(claim, dispatch);
  };

  // Whether the unverified warning dropdown is open
  const [showWarning, setShowWarning] = useState(false);
  // Animate the dropdown in
  const [warningVisible, setWarningVisible] = useState(false);
  const warningRef = useRef<HTMLDivElement>(null);
  // True only when verification was started by clicking the card (not the ? badge)
  const clickedCardRef = useRef(false);

  useEffect(() => {
    if (showWarning) {
      // Trigger CSS transition on next frame
      requestAnimationFrame(() => setWarningVisible(true));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarningVisible(false);
    }
  }, [showWarning]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!targetUrl) {
      return;
    }

    if (verifyStatus === "verified") {
      // Already verified - navigate normally
      return;
    }

    if (verifyStatus === "failed") {
      // Already failed - show warning instead of navigating
      e.preventDefault();
      setShowWarning(true);
      return;
    }

    if (verifyStatus === "loading") {
      // In-progress - block navigation
      e.preventDefault();
      return;
    }

    // idle - kick off verification before navigating
    e.preventDefault();
    clickedCardRef.current = true;
    handleVerify();
  };

  // When status transitions to verified, wait 250 ms then navigate
  const prevStatusRef = useRef<VerifyStatus>(verifyStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = verifyStatus;

    if (prev === "loading" && verifyStatus === "verified" && targetUrl) {
      if (clickedCardRef.current) {
        clickedCardRef.current = false;
        const t = setTimeout(() => {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }, 250);
        return () => clearTimeout(t);
      }
    }

    if (prev === "loading" && verifyStatus === "failed") {
      if (clickedCardRef.current) {
        clickedCardRef.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowWarning(true);
      }
    }
  }, [verifyStatus, targetUrl]);

  const cardContent = (
    <div className="flex items-center gap-4 p-4 border border-surface-border bg-surface transition-all cursor-pointer hover:-translate-y-0.5 hover:border-muted hover:shadow-md active:translate-y-0 active:shadow-none">
      {/* Service Icon */}
      <span className="shrink-0 w-8 flex items-center justify-center">
        <ServiceIcon service={value.type} size={28} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        {value.type === "dns" ? (
          <div className="font-semibold text-sm">{value.identity.subject}</div>
        ) : (
          <>
            <div className="font-semibold text-sm">{serviceName}</div>
            <div className="text-muted text-sm truncate">
              {value.identity.subject}
            </div>
          </>
        )}
      </div>

      {/* Status Badge */}
      <StatusBadge status={verifyStatus} onVerify={handleVerify} />
    </div>
  );

  return (
    <div className="flex flex-col">
      {targetUrl ? (
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="no-underline text-inherit"
          onClick={handleLinkClick}
        >
          {cardContent}
        </a>
      ) : (
        cardContent
      )}

      {/* Unverified warning dropdown */}
      <div
        ref={warningRef}
        style={{
          maxHeight: warningVisible ? "200px" : "0",
          opacity: warningVisible ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s ease, opacity 0.2s ease",
        }}
      >
        <div className="bg-red-950/60 border border-red-500/40 border-t-0 px-4 py-3 flex flex-col gap-3">
          <p className="text-sm text-red-200 leading-snug">
            <span className="font-semibold text-red-100">{CLAIM_WARNING.headsUp}</span>{" "}
            {CLAIM_WARNING.message(serviceName, value.identity.subject)}
          </p>
          <div className="flex gap-2">
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 transition-colors no-underline"
              onClick={() => setShowWarning(false)}
            >
              {NAV.goAnyway}
            </a>
            <button
              onClick={() => setShowWarning(false)}
              className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-white border border-surface-border hover:border-white/20 transition-colors"
            >
              {NAV.dismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
