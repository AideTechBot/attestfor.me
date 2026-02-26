import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";
import { ProofReplayVerification } from "./ProofReplayVerification";
import { getProofBorderColour } from "@/lib/proof-border-colour";
import { SERVICE_NAMES } from "@/lib/global-features";
import { ServiceIcon } from "./ServiceIcon";
import { useVerification } from "@/lib/verification-context";
import { runVerification } from "@/lib/run-verification";

interface DetailedProofCardProps {
  proof: AtProtoRecord<MeAttestProof.Main>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DetailedProofCard({ proof }: DetailedProofCardProps) {
  const { value } = proof;
  const [collapsed, setCollapsed] = useState(true);
  const lastVerifyRef = useRef<number>(0);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const { status, result, dispatch } = useVerification(proof.uri);

  const serviceName = SERVICE_NAMES[value.service] || value.service;
  const isActive = value.status !== "retracted";
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

  const borderColour = getProofBorderColour(recordStatus, verifyState);

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
    void runVerification(proof, dispatch);
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
          <ServiceIcon service={value.service} size={22} />
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
                    {value.status ?? "active"}
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
                  Handle
                </td>
                <td className="px-3 py-2 font-medium">{value.handle}</td>
              </tr>
              {value.proofUrl && (
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 text-xs font-medium text-muted align-top border-r border-surface-border">
                    Proof URL
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={value.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-xs break-all"
                    >
                      {value.proofUrl}
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
                  <td className="px-3 py-2 font-mono break-all">{proof.uri}</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                    CID
                  </td>
                  <td className="px-3 py-2 font-mono break-all">{proof.cid}</td>
                </tr>
                <tr
                  className={
                    value.challengeText ? "border-b border-surface-border" : ""
                  }
                >
                  <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                    Nonce
                  </td>
                  <td className="px-3 py-2 font-mono">{value.nonce}</td>
                </tr>
                {value.challengeText && (
                  <tr>
                    <td className="px-3 py-2 font-medium text-muted align-top border-r border-surface-border">
                      Challenge
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-pre-wrap">
                      {value.challengeText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {isActive && (
              <div className="px-4 py-4 border-t border-surface-border">
                <ProofReplayVerification
                  proof={proof}
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
