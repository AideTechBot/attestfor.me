import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceClaim } from "../../../types/keytrace";
import { useVerification } from "@/lib/verification-context";
import { runVerification, hasVerifierForUri } from "@/lib/run-verification";
import { CLAIMS, CLAIM_ERRORS, VERIFY } from "@/lib/ui-strings";

interface ClaimReplayVerificationProps {
  claim: AtProtoRecord<DevKeytraceClaim.Main>;
  // Rate limit window controlled by parent (UI-only)
  rateLimited?: boolean;
  // Called when the replay button is clicked — parent owns rate limit logic
  onReplayClick?: () => void;
}

export function ClaimReplayVerification({
  claim,
  rateLimited = false,
  onReplayClick,
}: ClaimReplayVerificationProps) {
  const { status, result, steps, dispatch } = useVerification(claim.uri);

  const verifying = status === "loading";
  const hasVerifier = hasVerifierForUri(claim.value.claimUri);

  const handleReplay = () => {
    if (verifying || rateLimited) {
      return;
    }
    void runVerification(claim, dispatch);
  };

  const handleClick = onReplayClick ?? handleReplay;

  if (!hasVerifier) {
    return (
      <div className="text-xs text-muted">
        {CLAIM_ERRORS.noVerifier(claim.value.type)}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={verifying || rateLimited}
        className="w-full h-10 flex items-center justify-center text-xs font-semibold bg-accent text-white border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? CLAIMS.verifying : VERIFY.replayVerification}
      </button>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5">
                {step.status === "success" && "✅"}
                {step.status === "error" && "❌"}
                {step.status === "pending" && "⏳"}
              </span>
              <div>
                <span className="font-semibold">{step.step}:</span>{" "}
                <span className="text-muted">{step.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final Result */}
      {result && (
        <div
          className={`mt-3 p-3 text-xs font-semibold ${
            result.success
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {result.success
            ? `✓ ${VERIFY.claimValid}`
            : `✗ ${VERIFY.claimInvalid(result.error ?? "")}`}
        </div>
      )}
    </div>
  );
}
