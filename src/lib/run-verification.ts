import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../types/lexicons";
import { GitHubVerifier } from "@/lib/verifiers/github";
import { TwitterVerifier } from "@/lib/verifiers/twitter";
import type { BaseProofVerifier } from "@/lib/verifiers/base-verifier";
import type {
  VerificationAction,
  VerificationStep,
} from "@/lib/verification-context";

const VERIFIERS: Record<string, () => BaseProofVerifier> = {
  github: () => new GitHubVerifier(),
  twitter: () => new TwitterVerifier(),
};

export { VERIFIERS };

export async function runVerification(
  proof: AtProtoRecord<MeAttestProof.Main>,
  dispatch: React.Dispatch<VerificationAction>,
): Promise<void> {
  const { uri, value } = proof;
  const factory = VERIFIERS[value.service];

  if (!factory) {
    dispatch({
      type: "VERIFY_DONE",
      uri,
      result: {
        success: false,
        error: `No verifier available for ${value.service}`,
        errorCode: "NO_VERIFIER",
      },
      steps: [],
    });
    return;
  }

  dispatch({ type: "VERIFY_START", uri });

  const currentSteps: VerificationStep[] = [];

  const addStep = (
    step: string,
    status: VerificationStep["status"],
    message: string,
  ) => {
    currentSteps.push({ step, status, message });
    dispatch({
      type: "VERIFY_STEP",
      uri,
      step: currentSteps[currentSteps.length - 1],
    });
  };

  const updateLastStep = (
    status: VerificationStep["status"],
    message: string,
  ) => {
    currentSteps[currentSteps.length - 1] = {
      ...currentSteps[currentSteps.length - 1],
      status,
      message,
    };
    // Re-dispatch VERIFY_STEP with the updated step — the reducer appends,
    // so we pass the full accumulated list via VERIFY_DONE at the end.
    // For live step updates we use a VERIFY_STEP_UPDATE action pattern instead:
    // here we just mutate in place and the final VERIFY_DONE carries the corrected steps.
  };

  try {
    addStep("Validate URL", "pending", "Checking proof URL format…");
    const verifier = factory();
    const urlValid = verifier.validateProofUrl(value.proofUrl);

    if (!urlValid) {
      updateLastStep("error", "Invalid proof URL format");
      dispatch({
        type: "VERIFY_DONE",
        uri,
        result: {
          success: false,
          error: "Invalid proof URL format",
          errorCode: "INVALID_URL",
        },
        steps: [...currentSteps],
      });
      return;
    }
    updateLastStep("success", "Proof URL format is valid");

    addStep("Check handle", "pending", "Validating handle…");
    const normalizedHandle = verifier.normalizeHandle(value.handle);
    updateLastStep("success", `Handle: ${normalizedHandle}`);

    addStep("Verify proof", "pending", "Fetching proof content and verifying…");
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

    dispatch({
      type: "VERIFY_DONE",
      uri,
      result: verificationResult,
      steps: [...currentSteps],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    currentSteps.push({ step: "Error", status: "error", message });
    dispatch({
      type: "VERIFY_DONE",
      uri,
      result: {
        success: false,
        error: message,
        errorCode: "UNKNOWN_ERROR",
      },
      steps: [...currentSteps],
    });
  }
}
