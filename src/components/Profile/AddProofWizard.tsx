import { useState } from "react";
import { ServiceIcon } from "./ServiceIcon";
import { SERVICE_NAMES } from "@/lib/service-names";
import { VERIFIERS } from "@/lib/run-verification";
import { generateNonce, formatChallengeText } from "@/lib/challenge";
import type { MeAttestProof } from "../../../types/lexicons";
import { LEXICON_NS } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────

export interface PendingProof {
  /** Temporary client-side id — not the final rkey */
  tempId: string;
  record: MeAttestProof.Main;
  /** Whether the proof passed verification before being staged */
  verified: boolean;
}

interface AddProofWizardProps {
  did: string;
  handle: string;
  onAdd: (proof: PendingProof) => void;
  onCancel: () => void;
}

type Step =
  | "select-service"
  | "enter-handle"
  | "show-challenge"
  | "verify"
  | "done";

// ── Helpers ────────────────────────────────────────────────────────

const SUPPORTED_SERVICES = Object.keys(VERIFIERS);

// ── Component ──────────────────────────────────────────────────────

export function AddProofWizard({ did, onAdd, onCancel }: AddProofWizardProps) {
  const [step, setStep] = useState<Step>("select-service");
  const [service, setService] = useState("");
  const [serviceHandle, setServiceHandle] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [nonce] = useState(() => generateNonce());
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [pendingProof, setPendingProof] = useState<PendingProof | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(challengeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const challengeText =
    service && serviceHandle
      ? formatChallengeText(did, serviceHandle.trim(), service, nonce)
      : "";

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

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);

    const factory = VERIFIERS[service];
    if (!factory) {
      setVerifyError("No verifier available for this service.");
      setVerifying(false);
      return;
    }

    const verifier = factory();

    if (!verifier.validateProofUrl(proofUrl.trim())) {
      setVerifyError("Invalid proof URL format for this service.");
      setVerifying(false);
      return;
    }

    try {
      const result = await verifier.verify(
        proofUrl.trim(),
        challengeText,
        serviceHandle.trim(),
      );

      if (result.success) {
        setVerifySuccess(true);
        const proof: PendingProof = {
          tempId: crypto.randomUUID(),
          record: {
            $type: `${LEXICON_NS}.proof`,
            service,
            handle: verifier.normalizeHandle(serviceHandle.trim()),
            proofUrl: proofUrl.trim() as `${string}:${string}`,
            nonce,
            challengeText,
            status: "active",
            createdAt: new Date().toISOString(),
          },
          verified: true,
        };
        setPendingProof(proof);
        setStep("done");
      } else {
        setVerifyError(result.error ?? "Verification failed.");
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = () => {
    if (pendingProof) {
      onAdd(pendingProof);
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="border border-surface-border bg-surface">
      {/* Step header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-sm font-semibold text-accent">
          {step === "select-service" && "Add proof — Select service"}
          {step === "enter-handle" &&
            `Add proof — ${SERVICE_NAMES[service] ?? service}`}
          {step === "show-challenge" && "Add proof — Post challenge"}
          {step === "verify" && "Add proof — Verify"}
          {step === "done" && "Add proof — Verified ✓"}
        </span>
        <button
          onClick={onCancel}
          className="text-muted hover:text-white transition-colors text-lg leading-none"
          aria-label="Cancel"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        {/* ── Step 1: Select service ── */}
        {step === "select-service" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted mb-2">
              Choose the service you want to link to your AT Protocol identity.
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
              Enter your {SERVICE_NAMES[service] ?? service} handle.
            </p>
            <input
              type="text"
              placeholder={service === "twitter" ? "@username" : "username"}
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
                Back
              </button>
              <button
                onClick={handleHandleSubmit}
                disabled={!serviceHandle.trim()}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Show challenge ── */}
        {step === "show-challenge" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              Post the following text publicly on{" "}
              <strong>{SERVICE_NAMES[service] ?? service}</strong> as{" "}
              <strong>{serviceHandle}</strong>, then paste the URL to that post
              below.
            </p>

            {/* Challenge text box */}
            <div className="relative">
              <pre className="whitespace-pre-wrap break-all text-xs bg-black/30 border border-surface-border p-3 font-mono leading-relaxed">
                {challengeText}
              </pre>
              <button
                onClick={handleCopy}
                className={`absolute top-2 right-2 text-xs transition-all duration-200 bg-surface border px-2 py-1 flex items-center gap-1 ${
                  copied
                    ? "border-green-500/50 text-green-400 scale-95"
                    : "border-surface-border text-muted hover:text-white hover:border-accent"
                }`}
                aria-label="Copy challenge text"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="1" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("enter-handle")}
                className="flex-1 py-2 text-xs border border-surface-border hover:border-muted transition-colors bg-transparent"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setVerifyError(null);
                  setStep("verify");
                }}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                I've posted it →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Verify ── */}
        {step === "verify" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              Paste the URL of the post containing the challenge text.
            </p>
            <input
              type="url"
              placeholder={
                service === "twitter"
                  ? "https://x.com/username/status/..."
                  : service === "github"
                    ? "https://gist.github.com/username/..."
                    : "https://..."
              }
              value={proofUrl}
              onChange={(e) => {
                setProofUrl(e.target.value);
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
                Back
              </button>
              <button
                onClick={() => void handleVerify()}
                disabled={verifying || !proofUrl.trim()}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Verifying…
                  </>
                ) : (
                  "Verify"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === "done" && verifySuccess && pendingProof && (
          <div className="flex flex-col gap-3">
            <div className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 p-3 font-semibold">
              ✓ Proof verified successfully
            </div>
            <div className="text-xs text-muted space-y-1">
              <div>
                <span className="text-white/60">Service:</span>{" "}
                {SERVICE_NAMES[service] ?? service}
              </div>
              <div>
                <span className="text-white/60">Handle:</span>{" "}
                {pendingProof.record.handle}
              </div>
              <div className="break-all">
                <span className="text-white/60">Proof URL:</span>{" "}
                {pendingProof.record.proofUrl}
              </div>
            </div>
            <p className="text-xs text-muted">
              This proof will be saved to your repo when you click{" "}
              <strong className="text-white/70">Save changes</strong>.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors font-semibold"
            >
              Add to list
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
