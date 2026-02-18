import { useState, useRef, useEffect } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";
import { GitHubVerifier } from "@/lib/verifiers/github";
import { TwitterVerifier } from "@/lib/verifiers/twitter";
import type {
  BaseProofVerifier,
  VerificationResult,
} from "@/lib/verifiers/base-verifier";

interface ProofReplayVerificationProps {
  proof: AtProtoRecord<MeAttestProof.Main>;
  // Optional: lift state from parent so the card header badge stays in sync
  externalVerifying?: boolean;
  externalResult?: VerificationResult | null;
  externalSteps?: VerificationStep[];
  onVerifyStart?: () => void;
  onVerifyDone?: (
    result: VerificationResult,
    steps: VerificationStep[],
  ) => void;
  // Increment to trigger a verification run from outside
  triggerCount?: number;
  // Whether the parent's rate limit window is active (disables the replay button)
  rateLimited?: boolean;
  // Called when the replay button is clicked — parent owns rate limit logic
  onReplayClick?: () => void;
}

export interface VerificationStep {
  step: string;
  status: "success" | "error" | "pending";
  message: string;
}

const VERIFIERS: Record<string, () => BaseProofVerifier> = {
  github: () => new GitHubVerifier(),
  twitter: () => new TwitterVerifier(),
};

export function ProofReplayVerification({
  proof,
  externalVerifying,
  externalResult,
  externalSteps,
  onVerifyStart,
  onVerifyDone,
  triggerCount = 0,
  rateLimited = false,
  onReplayClick,
}: ProofReplayVerificationProps) {
  const [internalVerifying, setInternalVerifying] = useState(false);
  const [internalResult, setInternalResult] =
    useState<VerificationResult | null>(null);
  const [internalSteps, setInternalSteps] = useState<VerificationStep[]>([]);
  const handleReplayRef = useRef<() => void>(() => {});

  const verifying = externalVerifying ?? internalVerifying;
  const result = externalResult !== undefined ? externalResult : internalResult;
  const steps = externalSteps ?? internalSteps;

  const { value } = proof;
  const hasVerifier = value.service in VERIFIERS;

  const handleReplay = async () => {
    if (!hasVerifier) {
      return;
    }

    setInternalVerifying(true);
    setInternalResult(null);
    setInternalSteps([]);
    onVerifyStart?.();

    const currentSteps: VerificationStep[] = [];

    const addStep = (
      step: string,
      status: VerificationStep["status"],
      message: string,
    ) => {
      currentSteps.push({ step, status, message });
      setInternalSteps([...currentSteps]);
    };

    const updateLastStep = (
      status: VerificationStep["status"],
      message: string,
    ) => {
      const last = currentSteps[currentSteps.length - 1];
      currentSteps[currentSteps.length - 1] = { ...last, status, message };
      setInternalSteps([...currentSteps]);
    };

    try {
      addStep("Validate URL", "pending", "Checking proof URL format…");
      const verifier = VERIFIERS[value.service]();
      const urlValid = verifier.validateProofUrl(value.proofUrl);

      if (!urlValid) {
        updateLastStep("error", "Invalid proof URL format");
        const r: VerificationResult = {
          success: false,
          error: "Invalid proof URL format",
          errorCode: "INVALID_URL",
        };
        setInternalResult(r);
        onVerifyDone?.(r, [...currentSteps]);
        return;
      }
      updateLastStep("success", "Proof URL format is valid");

      addStep("Check handle", "pending", "Validating handle…");
      const normalizedHandle = verifier.normalizeHandle(value.handle);
      updateLastStep("success", `Handle: ${normalizedHandle}`);

      addStep(
        "Verify proof",
        "pending",
        "Fetching proof content and verifying…",
      );
      const challengeText = value.challengeText || "";
      const verificationResult = await verifier.verify(
        value.proofUrl,
        challengeText,
        value.handle,
      );

      updateLastStep(
        verificationResult.success ? "success" : "error",
        verificationResult.success
          ? "Challenge text found and verified"
          : verificationResult.error || "Verification failed",
      );
      setInternalResult(verificationResult);
      onVerifyDone?.(verificationResult, [...currentSteps]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addStep("Error", "error", message);
      const r: VerificationResult = {
        success: false,
        error: message,
        errorCode: "UNKNOWN_ERROR",
      };
      setInternalResult(r);
      onVerifyDone?.(r, [...currentSteps]);
    } finally {
      setInternalVerifying(false);
    }
  };

  // Keep ref up to date so the useEffect below always calls the latest version
  handleReplayRef.current = handleReplay;

  // Fire when triggerCount changes (badge click from parent)
  useEffect(() => {
    if (triggerCount > 0) {
      handleReplayRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCount]);

  if (!hasVerifier) {
    return (
      <div className="text-xs text-muted">
        No verifier available for {value.service}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onReplayClick ?? handleReplay}
        disabled={verifying || rateLimited}
        className="w-full h-10 flex items-center justify-center text-xs font-semibold bg-accent text-white border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? "Verifying…" : "Replay verification"}
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
      {result && !verifying && (
        <div
          className={`mt-3 p-3 text-xs font-semibold ${
            result.success
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {result.success
            ? "✓ Proof is valid"
            : `✗ Proof is invalid: ${result.error}`}
        </div>
      )}
    </div>
  );
}
