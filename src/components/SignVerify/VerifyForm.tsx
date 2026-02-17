import { useState } from "react";
import {
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import * as openpgp from "openpgp";
import { listKeys } from "@/lib/atproto";
import { resolveHandle } from "@/lib/bsky";

interface VerifyResult {
  valid: boolean;
  fingerprint: string;
  signerName?: string;
}

export function VerifyForm() {
  const [signedMessage, setSignedMessage] = useState("");
  const [publicKeyInput, setPublicKeyInput] = useState("");
  const [identityInput, setIdentityInput] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [keySource, setKeySource] = useState<"paste" | "lookup">("paste");

  const handleVerify = async () => {
    if (!signedMessage.trim()) {
      return;
    }

    setVerifying(true);
    setError(null);
    setResult(null);

    try {
      let armoredPublicKey = publicKeyInput;

      // If using identity lookup, fetch their PGP keys from AT Proto
      if (keySource === "lookup" && identityInput.trim()) {
        let did = identityInput.trim();

        // If it looks like a handle (not a DID), resolve it first
        if (!did.startsWith("did:")) {
          const resolved = await resolveHandle(did.replace(/^@/, ""));
          if (!resolved) {
            throw new Error(`Could not resolve handle: ${did}`);
          }
          did = resolved;
        }

        const keys = await listKeys(did);
        const pgpKey = keys.find(
          (k) => k.value.keyType === "pgp" && k.value.status === "active",
        );
        if (!pgpKey) {
          throw new Error("No active PGP key found for this identity");
        }
        armoredPublicKey = pgpKey.value.publicKey;
      }

      if (!armoredPublicKey.trim()) {
        throw new Error("Provide a public key or look up an identity");
      }

      const publicKey = await openpgp.readKey({
        armoredKey: armoredPublicKey,
      });
      const message = await openpgp.readCleartextMessage({
        cleartextMessage: signedMessage,
      });

      const verification = await openpgp.verify({
        message,
        verificationKeys: publicKey,
      });

      const { verified } = verification.signatures[0];
      await verified; // throws if invalid

      const user = await publicKey.getPrimaryUser();
      const signerName =
        user?.user?.userID?.name || user?.user?.userID?.email || undefined;

      setResult({
        valid: true,
        fingerprint: publicKey.getFingerprint().toUpperCase(),
        signerName,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      // openpgp throws on invalid signature
      if (
        message.includes("Could not find signing key") ||
        message.includes("Signature verification failed")
      ) {
        setResult({ valid: false, fingerprint: "" });
      } else {
        setError(message);
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="verify-signed-message">
          Signed Message
        </label>
        <textarea
          id="verify-signed-message"
          value={signedMessage}
          onChange={(e) => setSignedMessage(e.target.value)}
          placeholder="Paste the PGP cleartext-signed message..."
          className="min-h-[160px] w-full resize-y rounded border border-surface-border bg-input p-3 font-mono text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
          spellCheck={false}
        />
      </div>

      {/* Key source selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setKeySource("paste")}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            keySource === "paste"
              ? "bg-accent text-white"
              : "border border-surface-border text-muted hover:text-white"
          }`}
        >
          Paste Public Key
        </button>
        <button
          onClick={() => setKeySource("lookup")}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            keySource === "lookup"
              ? "bg-accent text-white"
              : "border border-surface-border text-muted hover:text-white"
          }`}
        >
          Look Up Identity
        </button>
      </div>

      {keySource === "paste" ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="verify-public-key">
            Signer&apos;s Public Key
          </label>
          <textarea
            id="verify-public-key"
            value={publicKeyInput}
            onChange={(e) => setPublicKeyInput(e.target.value)}
            placeholder="Paste the signer's ASCII-armored PGP public key..."
            className="min-h-[120px] w-full resize-y rounded border border-surface-border bg-input p-3 font-mono text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="verify-identity">
            Signer&apos;s DID or Handle
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="verify-identity"
              type="text"
              value={identityInput}
              onChange={(e) => setIdentityInput(e.target.value)}
              placeholder="e.g., manoo.dev or did:plc:abc123"
              className="w-full rounded border border-surface-border bg-input py-2 pl-9 pr-3 text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted">
            Will fetch the signer&apos;s published PGP key from their AT Proto
            repository
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div
          className={`flex items-start gap-3 rounded border p-4 ${
            result.valid
              ? "border-green-500/30 bg-green-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          {result.valid ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          ) : (
            <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          )}
          <div className="flex flex-col gap-1">
            <span
              className={`text-sm font-medium ${
                result.valid ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.valid ? "Signature is valid" : "Signature is invalid"}
            </span>
            {result.valid && result.fingerprint && (
              <span className="font-mono text-xs text-muted">
                Fingerprint: {result.fingerprint}
              </span>
            )}
            {result.valid && result.signerName && (
              <span className="text-xs text-muted">
                Signer: {result.signerName}
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={
          !signedMessage.trim() ||
          (keySource === "paste" && !publicKeyInput.trim()) ||
          (keySource === "lookup" && !identityInput.trim()) ||
          verifying
        }
        className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {verifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Verify Signature
          </>
        )}
      </button>
    </div>
  );
}
