import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceClaim } from "../../../types/keytrace";
import { ClaimReplayVerification } from "./ClaimReplayVerification";
import { getClaimBorderColour } from "@/lib/claim-border-colour";
import { SERVICE_NAMES } from "@/lib/global-features";
import { ServiceIcon } from "./ServiceIcon";
import { useVerification } from "@/lib/verification-context";
import { runVerification } from "@/lib/run-verification";

interface DetailedClaimCardProps {
  claim: AtProtoRecord<DevKeytraceClaim.Main>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DetailedClaimCard({ claim }: DetailedClaimCardProps) {
  const { value } = claim;
  const [collapsed, setCollapsed] = useState(true);
  const lastVerifyRef = useRef<number>(0);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const { status, result, dispatch } = useVerification(claim.uri);

  const serviceName = SERVICE_NAMES[value.type] || value.type;
  const isActive = !value.retractedAt;
  const recordStatus = isActive ? "active" : "retracted";

  const verifyState =
    status === "loading"
      ? result?.success === true
        ? "verified"
        : result?.success === false
          ? "failed"
          : "loading"
      : status === "idle"
        ? "idle"
        : result?.success
          ? "verified"
          : "failed";

  const borderColour = getClaimBorderColour(recordStatus, verifyState);

  const triggerVerify = () => {
    const now = Date.now();
    if (now - lastVerifyRef.current < 1000 || status === "loading") {
      return;
    }
    lastVerifyRef.current = now;
    setRateLimited(true);
    if (rateLimitTimerRef.current) {
      clearTimeout(rateLimitTimerRef.current);
    }
    rateLimitTimerRef.current = setTimeout(() => setRateLimited(false), 1000);
    void runVerification(claim, dispatch);
  };

  const handleVerifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerVerify();
  };

  return (
    <div className="border border-surface-border overflow-hidden transition-shadow hover:shadow-md">
      {/* Header row — click to collapse/expand body */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-surface-border cursor-pointer bg-transparent transition-colors hover:bg-white/5 border-l-4 ${borderColour} ${collapsed ? "border-b-0" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <ServiceIcon service={value.type} size={22} />
          <span className="font-semibold text-sm">{serviceName}</span>
        </div>
        <ChevronDown
          className={`w-3 h-3 text-muted transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Table of fields */}
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-20" />
              <col />
            </colgroup>
            <tbody>
              <tr className="border-b border-surface-border">
                <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                  Status
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs ${!isActive ? "text-red-400 font-semibold" : ""}`}
                  >
                    {value.retractedAt
                      ? "retracted"
                      : (value.status ?? "verified")}
                  </span>
                </td>
              </tr>
              {isActive && (
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                    Verification
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={handleVerifyClick}
                      disabled={status === "loading" || rateLimited}
                      title={
                        result
                          ? result.success
                            ? "Passed — click to re-run"
                            : "Failed — click to retry"
                          : "Click to verify"
                      }
                      className={`text-xs font-semibold bg-transparent border-none p-0 cursor-pointer transition-colors disabled:cursor-not-allowed ${
                        status === "loading"
                          ? "text-white/40"
                          : status === "idle"
                            ? "text-white/50 hover:text-white/80"
                            : result?.success
                              ? "text-green-400 hover:text-green-300"
                              : "text-red-400 hover:text-red-300"
                      }`}
                    >
                      {status === "loading"
                        ? "verifying…"
                        : status === "idle"
                          ? "unknown"
                          : result?.success
                            ? "passed"
                            : "failed"}
                    </button>
                  </td>
                </tr>
              )}
              <tr className="border-b border-surface-border">
                <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                  Subject
                </td>
                <td className="px-3 py-2 font-medium">
                  {value.identity.subject}
                </td>
              </tr>
              {value.claimUri && (
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                    Claim URI
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={value.claimUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-xs break-all"
                    >
                      {value.claimUri}
                    </a>
                  </td>
                </tr>
              )}
              <tr
                className={
                  value.retractedAt ? "border-b border-surface-border" : ""
                }
              >
                <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                  Created
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {formatDate(value.createdAt)}
                </td>
              </tr>
              {value.retractedAt && (
                <tr>
                  <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                    Retracted
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {formatDate(value.retractedAt)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Technical details */}
          <div className="border-t border-surface-border bg-page">
            <table className="w-full text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-20" />
                <col />
              </colgroup>
              <tbody>
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                    Record URI
                  </td>
                  <td className="px-3 py-2 font-mono break-all">{claim.uri}</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                    CID
                  </td>
                  <td className="px-3 py-2 font-mono break-all">{claim.cid}</td>
                </tr>
                {value.nonce && (
                  <tr>
                    <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                      Nonce
                    </td>
                    <td className="px-3 py-2 font-mono">{value.nonce}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {isActive && (
              <div className="px-4 py-4 border-t border-surface-border">
                <ClaimReplayVerification
                  claim={claim}
                  rateLimited={rateLimited}
                  onReplayClick={triggerVerify}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
