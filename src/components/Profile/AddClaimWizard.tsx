import { useState } from "react";
import { Loader2, Check, Copy, ArrowRight } from "lucide-react";
import { WizardShell } from "./WizardShell";
import { ServiceIcon } from "./ServiceIcon";
import { SERVICE_NAMES } from "@/lib/global-features";
import {
  createClaim,
  verifyClaim,
  ClaimStatus,
  serviceProviders,
} from "@keytrace/runner";
import type { DevKeytraceClaim } from "../../../types/keytrace";
import { ids } from "../../../types/keytrace";
import { createProxiedFetch } from "@/lib/proxied-fetch";
import { getVerifyErrorMessage } from "@/lib/run-verification";
import { getApiBase } from "@/lib/get-api-base";
import {
  NAV,
  CLAIMS,
  CLAIM_WIZARD,
  CLAIM_ERRORS,
  PROFILE,
  VERIFY_ERRORS,
} from "@/lib/ui-strings";

// ── Types ──────────────────────────────────────────────────────────

export interface PendingClaim {
  /** Temporary client-side id - not the final rkey */
  tempId: string;
  record: DevKeytraceClaim.Main;
  /** Whether the claim passed verification before being staged */
  verified: boolean;
}

interface AddClaimWizardProps {
  did: string;
  handle: string;
  onAdd: (claim: PendingClaim) => void;
  onCancel: () => void;
}

type Step =
  | "select-service"
  | "enter-handle"
  | "show-challenge"
  | "verify"
  | "done";

// ── Helpers ────────────────────────────────────────────────────────

const ALL_PROVIDERS = serviceProviders.getAllProviders();
// PGP keys are stored in a separate lexicon (dev.keytrace.userPublicKey), not as claims
const SUPPORTED_SERVICES = ALL_PROVIDERS.map((p) => p.id).filter((id) => id !== "pgp");

// ── Component ──────────────────────────────────────────────────────

export function AddClaimWizard({ did, onAdd, onCancel }: AddClaimWizardProps) {
  const [step, setStep] = useState<Step>("select-service");
  const [service, setService] = useState("");
  const [serviceHandle, setServiceHandle] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [copied, setCopied] = useState(false);

  const provider = service ? serviceProviders.getProvider(service) : undefined;
  const isDns = service === "dns";

  /** The text the user should post as proof. */
  const proofText = provider ? provider.getProofText(did) : "";

  /** For DNS, construct the claim URI automatically. */
  const dnsClaimUri = isDns ? `dns:${serviceHandle.trim()}` : "";

  const handleCopy = () => {
    void navigator.clipboard.writeText(proofText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSelectService = (svc: string) => {
    setService(svc);
    setStep("enter-handle");
  };

  const handleHandleSubmit = () => {
    if (!serviceHandle.trim()) {
      return;
    }
    setStep("show-challenge");
  };

  /** Verify DNS using our server-side endpoint (browser can't do DNS lookups) */
  const verifyDns = async (): Promise<boolean> => {
    const domain = serviceHandle.trim();
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

    // Check if any TXT record contains our DID
    const proofText = provider?.getProofText(did) ?? did;
    const found = data.records.txt.some(
      (record) => record.includes(did) || record.includes(proofText),
    );

    return found;
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);

    // For DNS, use our own verification via server endpoint
    if (isDns) {
      try {
        const verified = await verifyDns();

        if (verified) {
          setVerifySuccess(true);

          const pending: PendingClaim = {
            tempId: crypto.randomUUID(),
            record: {
              $type: ids.DevKeytraceClaim,
              type: service,
              claimUri: dnsClaimUri,
              identity: {
                subject: serviceHandle.trim(),
              },
              sigs: [],
              status: "verified",
              createdAt: new Date().toISOString(),
            },
            verified: true,
          };
          setPendingClaim(pending);
          setStep("done");
        } else {
          setVerifyError(
            `${VERIFY_ERRORS.noTxtRecord(serviceHandle.trim())}. ${CLAIM_WIZARD.dnsPropagation}`,
          );
        }
      } catch (e) {
        setVerifyError(e instanceof Error ? e.message : CLAIM_ERRORS.dnsVerificationFailed);
      } finally {
        setVerifying(false);
      }
      return;
    }

    // For other services, use keytrace runner
    const claimUri = claimUrl.trim();

    // Quick sanity: does the runner recognise this URI?
    const matches = serviceProviders.matchUri(claimUri);
    if (matches.length === 0) {
      setVerifyError(CLAIM_ERRORS.urlNoMatch);
      setVerifying(false);
      return;
    }

    try {
      const claim = createClaim(claimUri, did);
      const result = await verifyClaim(claim, {
        fetch: createProxiedFetch(),
      });

      if (result.status === ClaimStatus.VERIFIED) {
        // Handle check - make sure the claim source matches the claimed handle
        const expectedHandle = serviceHandle
          .trim()
          .toLowerCase()
          .replace(/^@/, "");
        const actualSubject = result.identity?.subject
          ?.toLowerCase()
          .replace(/^@/, "");

        if (actualSubject && actualSubject !== expectedHandle) {
          setVerifyError(
            `${CLAIM_ERRORS.handleMismatch}: the claim belongs to "${result.identity?.subject}", but you entered "${serviceHandle.trim()}".`,
          );
          setVerifying(false);
          return;
        }

        setVerifySuccess(true);

        const subject =
          result.identity?.subject ?? serviceHandle.trim().replace(/^@/, "");

        const pending: PendingClaim = {
          tempId: crypto.randomUUID(),
          record: {
            $type: ids.DevKeytraceClaim,
            type: service,
            claimUri: claimUri,
            identity: {
              subject,
            },
            sigs: [],
            status: "verified",
            createdAt: new Date().toISOString(),
          },
          verified: true,
        };
        setPendingClaim(pending);
        setStep("done");
      } else {
        setVerifyError(getVerifyErrorMessage(result));
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = () => {
    if (pendingClaim) {
      onAdd(pendingClaim);
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  const stepTitle = CLAIM_WIZARD.title(step, SERVICE_NAMES[service] ?? service, isDns);

  return (
    <WizardShell title={stepTitle} onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        {/* ── Step 1: Select service ── */}
        {step === "select-service" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted mb-2">
              {CLAIM_WIZARD.selectServiceDesc}
            </p>
            {SUPPORTED_SERVICES.map((svc) => (
              <button
                key={svc}
                onClick={() => handleSelectService(svc)}
                className="flex items-center gap-3 px-4 py-3 border border-surface-border bg-transparent hover:border-accent hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <ServiceIcon service={svc} size={20} />
                <span className="text-sm font-semibold">
                  {SERVICE_NAMES[svc] ?? svc}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Enter handle ── */}
        {step === "enter-handle" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              {isDns
                ? CLAIM_WIZARD.enterDomain
                : CLAIM_WIZARD.enterHandle(SERVICE_NAMES[service] ?? service)}
            </p>
            <input
              type="text"
              aria-label={isDns ? "Domain" : `Your ${SERVICE_NAMES[service] ?? service} handle`}
              placeholder={isDns ? "example.com" : service === "twitter" ? "@username" : "username"}
              value={serviceHandle}
              onChange={(e) => setServiceHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleHandleSubmit()}
              autoFocus
              className="w-full px-3 py-2 bg-input border border-surface-border text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStep("select-service")}
                className="flex-1 py-2 text-xs border border-surface-border hover:border-muted transition-colors bg-transparent"
              >
                {NAV.back}
              </button>
              <button
                onClick={handleHandleSubmit}
                disabled={!serviceHandle.trim()}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {NAV.next}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Show proof text ── */}
        {step === "show-challenge" && (
          <div className="flex flex-col gap-3">
            {isDns ? (
              <>
                <p className="text-xs text-muted">
                  Add a <strong>TXT record</strong> at{" "}
                  <code className="bg-black/30 px-1.5 py-0.5 font-mono">
                    _keytrace.{serviceHandle.trim()}
                  </code>{" "}
                  with the following value:
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted">
                  {CLAIM_WIZARD.postInstruction(SERVICE_NAMES[service] ?? service, serviceHandle)}
                </p>

                {provider?.ui.instructions && (
                  <ul className="text-xs text-muted list-disc list-inside space-y-1">
                    {provider.ui.instructions.map((instruction, i) => (
                      <li key={i}>{instruction}</li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* Proof text box */}
            <div className="relative">
              <pre className="whitespace-pre-wrap break-all text-xs bg-black/30 border border-surface-border p-3 font-mono leading-relaxed">
                {proofText}
              </pre>
              <button
                onClick={handleCopy}
                className={`absolute top-2 right-2 text-xs transition-all duration-200 bg-surface border px-2 py-1 flex items-center gap-1 ${
                  copied
                    ? "border-green-500/50 text-green-400 scale-95"
                    : "border-surface-border text-muted hover:text-white hover:border-accent"
                }`}
                aria-label="Copy proof text"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    {PROFILE.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    {CLAIM_WIZARD.copy}
                  </>
                )}
              </button>
            </div>

            {isDns && (
              <p className="text-xs text-muted">
                {CLAIM_WIZARD.dnsPropagation}
              </p>
            )}

            {verifyError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-3">
                ✗ {verifyError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("enter-handle")}
                disabled={verifying}
                className="flex-1 py-2 text-xs border border-surface-border hover:border-muted transition-colors bg-transparent disabled:opacity-50"
              >
                {NAV.back}
              </button>
              {isDns ? (
                <button
                  onClick={() => void handleVerify()}
                  disabled={verifying}
                  className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {CLAIMS.verifying}
                    </>
                  ) : (
                    CLAIMS.verify
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setVerifyError(null);
                    setStep("verify");
                  }}
                  className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors"
                >
                  {CLAIM_WIZARD.iPostedIt} <ArrowRight className="w-3 h-3 inline" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Verify ── */}
        {step === "verify" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              {CLAIM_WIZARD.pasteUrl}
            </p>
            <input
              type="url"
              placeholder={provider?.ui.inputPlaceholder ?? CLAIM_WIZARD.urlPlaceholder}
              value={claimUrl}
              onChange={(e) => {
                setClaimUrl(e.target.value);
                setVerifyError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleVerify()}
              autoFocus
              className="w-full px-3 py-2 bg-input border border-surface-border text-sm outline-none focus:border-accent"
            />

            {verifyError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-3">
                ✗ {verifyError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("show-challenge")}
                disabled={verifying}
                className="flex-1 py-2 text-xs border border-surface-border hover:border-muted transition-colors bg-transparent disabled:opacity-50"
              >
                {NAV.back}
              </button>
              <button
                onClick={() => void handleVerify()}
                disabled={verifying || !claimUrl.trim()}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {CLAIMS.verifying}
                  </>
                ) : (
                  CLAIMS.verify
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === "done" && verifySuccess && pendingClaim && (
          <div className="flex flex-col gap-3">
            <div className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 p-3 font-semibold">
              ✓ {CLAIM_WIZARD.claimVerified}
            </div>
            <div className="text-xs text-muted space-y-1">
              <div>
                <span className="text-white/60">{CLAIM_WIZARD.service}</span>{" "}
                {SERVICE_NAMES[service] ?? service}
              </div>
              <div>
                <span className="text-white/60">{CLAIM_WIZARD.handle}</span>{" "}
                {pendingClaim.record.identity.subject}
              </div>
              <div className="break-all">
                <span className="text-white/60">{CLAIM_WIZARD.claimUri}</span>{" "}
                {pendingClaim.record.claimUri}
              </div>
            </div>
            <p className="text-xs text-muted">
              {CLAIM_WIZARD.saveNote.replace("Save changes", "")}
              <strong className="text-white/70">{NAV.save.replace(" changes", "")}</strong>.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors font-semibold"
            >
              {CLAIM_WIZARD.addToList}
            </button>
          </div>
        )}
      </div>
    </WizardShell>
  );
}
