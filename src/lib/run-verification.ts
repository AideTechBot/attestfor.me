import {
  createClaim,
  verifyClaim,
  ClaimStatus,
  serviceProviders,
} from "@keytrace/runner";
import type { ClaimVerificationResult } from "@keytrace/runner";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceClaim } from "../../types/keytrace";
import type {
  VerificationAction,
  VerificationStep,
} from "@/lib/verification-context";
import { createProxiedFetch } from "@/lib/proxied-fetch";
import { getApiBase } from "@/lib/get-api-base";
import {
  VERIFY_ERRORS,
  VERIFY_STEPS,
  CLAIM_ERRORS,
} from "@/lib/ui-strings";

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Generate a user-friendly error message from verification result.
 * Exported so it can be used in AddClaimWizard as well.
 */
export function getVerifyErrorMessage(result: ClaimVerificationResult): string {
  // If there are explicit errors, use them
  if (result.errors.length > 0) {
    return result.errors.join("; ");
  }

  const details = result.proofDetails;
  if (!details?.targets) {
    return VERIFY_ERRORS.noProofContent;
  }

  // Check if any target path had values
  const targetsWithValues = details.targets.filter(
    (t) => t.valuesFound && t.valuesFound.length > 0,
  );

  if (targetsWithValues.length === 0) {
    // No expected files/paths were found
    const expectedPaths = details.targets
      .map((t) => t.path.join("."))
      .filter((p) => p.includes("files."))
      .map((p) => p.replace("files.", "").replace(".content", ""));

    if (expectedPaths.length > 0) {
      return VERIFY_ERRORS.noExpectedFile(expectedPaths.join(", "));
    }
    return VERIFY_ERRORS.noContentAtLocation;
  }

  // Values were found but DID wasn't in them
  return VERIFY_ERRORS.didNotFound;
}

/**
 * Build a `Set` of service IDs that have a registered provider in the runner.
 */
const ALL_PROVIDERS = serviceProviders.getAllProviders();
export const SUPPORTED_SERVICES = new Set(ALL_PROVIDERS.map((p) => p.id));

/**
 * Check whether the runner has a provider that matches a given claim URI.
 */
export function hasVerifierForUri(claimUri: string): boolean {
  return serviceProviders.matchUri(claimUri).length > 0;
}

/**
 * Verify DNS claim using server-side endpoint (browser can't do DNS lookups).
 * Returns true if DID found in TXT records, false otherwise.
 */
async function verifyDnsViaServer(domain: string, did: string): Promise<boolean> {
  const apiBase = getApiBase();
  const response = await fetch(
    `${apiBase}/api/dns?domain=${encodeURIComponent(domain)}`,
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || CLAIM_ERRORS.dnsLookupFailed);
  }

  const data = (await response.json()) as {
    records: { txt: string[] };
  };

  // Check if any TXT record contains the DID
  const provider = serviceProviders.getProvider("dns");
  const proofText = provider?.getProofText(did) ?? did;

  return data.records.txt.some(
    (record) => record.includes(did) || record.includes(proofText),
  );
}

// ── Main entry point ─────────────────────────────────────────────

export async function runVerification(
  claim: AtProtoRecord<DevKeytraceClaim.Main>,
  dispatch: React.Dispatch<VerificationAction>,
): Promise<void> {
  const { uri, value } = claim;

  // Quick check: does the runner recognise this claim URI?
  const matches = serviceProviders.matchUri(value.claimUri);
  if (matches.length === 0) {
    dispatch({
      type: "VERIFY_DONE",
      uri,
      result: {
        success: false,
        error: CLAIM_ERRORS.noVerifier(value.type),
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
    if (currentSteps.length > 0) {
      currentSteps[currentSteps.length - 1] = {
        ...currentSteps[currentSteps.length - 1],
        status,
        message,
      };
    }
  };

  // Extract the DID from the AT URI (at://did:plc:xxx/collection/rkey)
  const did = uri.startsWith("at://") ? uri.split("/")[2] : "";

  try {
    // Step 1: Match claim URI
    addStep("Match claim", "pending", VERIFY_STEPS.checkingUri);
    const provider = matches[0].provider;
    updateLastStep("success", VERIFY_STEPS.matchedProvider(provider.name));

    // Step 2: Verify claim
    addStep("Verify claim", "pending", VERIFY_STEPS.fetchingContent);

    // DNS claims need special handling (browser can't do DNS lookups)
    if (value.type === "dns" && value.claimUri.startsWith("dns:")) {
      const domain = value.claimUri.replace("dns:", "");
      const verified = await verifyDnsViaServer(domain, did);

      if (verified) {
        updateLastStep("success", VERIFY_STEPS.didFoundInDns);

        dispatch({
          type: "VERIFY_DONE",
          uri,
          result: { success: true },
          steps: [...currentSteps],
        });
      } else {
        updateLastStep("error", VERIFY_ERRORS.noTxtRecord(domain));

        dispatch({
          type: "VERIFY_DONE",
          uri,
          result: {
            success: false,
            error: VERIFY_ERRORS.noTxtRecord(domain),
            errorCode: "VERIFICATION_FAILED",
          },
          steps: [...currentSteps],
        });
      }
      return;
    }

    // For other services, use keytrace runner
    const claim = createClaim(value.claimUri, did);
    const result: ClaimVerificationResult = await verifyClaim(claim, {
      fetch: createProxiedFetch(),
    });

    if (result.status === ClaimStatus.VERIFIED) {
      updateLastStep("success", "DID found in claim content");

      // Step 3: Handle check (attestfor.me-specific)
      addStep("Check handle", "pending", VERIFY_STEPS.verifyingHandle);

      const expectedHandle = value.identity.subject
        .toLowerCase()
        .replace(/^@/, "");
      const actualSubject = result.identity?.subject
        ?.toLowerCase()
        .replace(/^@/, "");

      if (actualSubject && actualSubject !== expectedHandle) {
        updateLastStep(
          "error",
          VERIFY_ERRORS.handleMismatch(expectedHandle, actualSubject),
        );
        dispatch({
          type: "VERIFY_DONE",
          uri,
          result: {
            success: false,
            error: VERIFY_ERRORS.handleMismatch(expectedHandle, actualSubject),
            errorCode: "HANDLE_MISMATCH",
          },
          steps: [...currentSteps],
        });
        return;
      }

      updateLastStep(
        "success",
        VERIFY_STEPS.handleVerified(result.identity?.subject ?? expectedHandle),
      );

      dispatch({
        type: "VERIFY_DONE",
        uri,
        result: { success: true },
        steps: [...currentSteps],
      });
    } else {
      const errorMsg = getVerifyErrorMessage(result);
      updateLastStep("error", errorMsg);

      dispatch({
        type: "VERIFY_DONE",
        uri,
        result: {
          success: false,
          error: errorMsg,
          errorCode:
            result.status === ClaimStatus.ERROR
              ? "PROVIDER_ERROR"
              : "VERIFICATION_FAILED",
        },
        steps: [...currentSteps],
      });
    }
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
