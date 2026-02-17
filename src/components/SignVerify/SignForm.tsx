import { useState } from "react";
import {
  PenLine,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import * as openpgp from "openpgp";

export function SignForm() {
  const [message, setMessage] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [signedMessage, setSignedMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSign = async () => {
    if (!message.trim() || !privateKey.trim()) {
      return;
    }

    setSigning(true);
    setError(null);
    setSignedMessage("");

    try {
      let key = await openpgp.readPrivateKey({ armoredKey: privateKey });
      if (!key.isDecrypted()) {
        if (!passphrase) {
          throw new Error("Key is encrypted — passphrase required");
        }
        key = await openpgp.decryptKey({ privateKey: key, passphrase });
      }

      const signed = await openpgp.sign({
        message: await openpgp.createCleartextMessage({ text: message }),
        signingKeys: key,
      });

      setSignedMessage(signed as string);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(signedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="sign-message">
          Message
        </label>
        <textarea
          id="sign-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message to sign..."
          className="min-h-[120px] w-full resize-y rounded border border-surface-border bg-input p-3 text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="sign-private-key">
          PGP Private Key
        </label>
        <textarea
          id="sign-private-key"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="Paste your ASCII-armored PGP private key..."
          className="min-h-[120px] w-full resize-y rounded border border-surface-border bg-input p-3 font-mono text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
          spellCheck={false}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          Your private key never leaves your browser
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="sign-passphrase">
          Passphrase{" "}
          <span className="text-xs text-muted font-normal">
            (if key is encrypted)
          </span>
        </label>
        <div className="relative">
          <input
            id="sign-passphrase"
            type={showPassphrase ? "text" : "password"}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase..."
            className="w-full rounded border border-surface-border bg-input px-3 py-2 pr-10 text-sm text-white/90 placeholder:text-muted/50 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassphrase(!showPassphrase)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white"
          >
            {showPassphrase ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={!message.trim() || !privateKey.trim() || signing}
        className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {signing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing...
          </>
        ) : (
          <>
            <PenLine className="h-4 w-4" />
            Sign Message
          </>
        )}
      </button>

      {signedMessage && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Signed Message</label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted transition-colors hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-surface-border bg-input p-3 font-mono text-xs text-white/90">
            {signedMessage}
          </pre>
        </div>
      )}
    </div>
  );
}
