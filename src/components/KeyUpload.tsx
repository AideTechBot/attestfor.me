import { useState, useCallback } from "react";
import { Upload, Key, AlertCircle, FileUp, Loader2 } from "lucide-react";
import { parseKey, type ParsedKey } from "@/lib/key-parser";
import { publishKey } from "@/lib/atproto";

interface KeyUploadProps {
  onSuccess: (uri: string, cid: string) => void;
}

const KEY_TYPE_LABELS: Record<string, string> = {
  pgp: "PGP / GPG",
  "ssh-ed25519": "SSH Ed25519",
  "ssh-ecdsa": "SSH ECDSA",
};

export function KeyUpload({ onSuccess }: KeyUploadProps) {
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const [parsed, setParsed] = useState<ParsedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleKeyChange = useCallback(async (value: string) => {
    setPublicKey(value);
    setError(null);
    setParsed(null);

    if (!value.trim()) {
      return;
    }

    try {
      const result = await parseKey(value);
      setParsed(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid key");
    }
  }, []);

  const handleSubmit = async () => {
    if (!parsed) {
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const { uri, cid } = await publishKey({
        $type: "me.attest.key",
        keyType: parsed.keyType,
        fingerprint: parsed.fingerprint,
        publicKey: parsed.publicKey,
        label: label || undefined,
        comment: parsed.comment,
        expiresAt: parsed.expiresAt,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      onSuccess(uri, cid);
      // Reset form
      setPublicKey("");
      setLabel("");
      setParsed(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    await handleKeyChange(text);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="key-input">
          Public Key
        </label>
        <textarea
          id="key-input"
          value={publicKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="Paste your public key here (PGP, SSH Ed25519, or SSH ECDSA)..."
          className="min-h-[160px] w-full resize-y rounded border border-surface-border bg-input p-3 font-mono text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-surface-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-white">
            <FileUp className="h-3.5 w-3.5" />
            Upload file
            <input
              type="file"
              accept=".pub,.asc,.key,.txt"
              onChange={handleFileLoad}
              className="hidden"
            />
          </label>
          <span className="text-xs text-muted">or paste key above</span>
        </div>
      </div>

      {/* Detected key info */}
      {parsed && (
        <div className="flex flex-col gap-2 rounded border border-accent/30 bg-accent-subtle p-3">
          <div className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4 text-accent" />
            <span className="font-medium">
              {KEY_TYPE_LABELS[parsed.keyType] || parsed.keyType}
            </span>
            {parsed.algorithm && (
              <span className="text-xs text-muted">({parsed.algorithm})</span>
            )}
          </div>
          <div className="text-xs font-mono text-muted break-all">
            {parsed.fingerprint}
          </div>
          {parsed.comment && (
            <div className="text-xs text-muted">{parsed.comment}</div>
          )}
          {parsed.expiresAt && (
            <div className="text-xs text-muted">
              Expires: {new Date(parsed.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Label input */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="key-label">
          Label{" "}
          <span className="text-xs text-muted font-normal">(optional)</span>
        </label>
        <input
          id="key-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., work laptop, signing key"
          className="w-full rounded border border-surface-border bg-input px-3 py-2 text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
        />
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!parsed || uploading}
        className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Publish Key
          </>
        )}
      </button>
    </div>
  );
}
