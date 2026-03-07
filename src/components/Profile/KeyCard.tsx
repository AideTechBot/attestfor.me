import { useState } from "react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceUserPublicKey } from "../../../types/keytrace";
import { KEY_TYPE_LABELS } from "@/lib/global-features";
import { KEYS, PROFILE } from "@/lib/ui-strings";

interface KeyCardProps {
  keyRecord: AtProtoRecord<DevKeytraceUserPublicKey.Main>;
}

const KEY_ICONS: Record<string, string> = {
  pgp: "🔐",
  "ssh-ed25519": "🔑",
  "ssh-ecdsa": "🔑",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function KeyCard({ keyRecord }: KeyCardProps) {
  const { value } = keyRecord;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const icon = KEY_ICONS[value.keyType] || "🔑";
  const typeLabel = KEY_TYPE_LABELS[value.keyType] || value.keyType;
  const isExpired =
    value.expiresAt != null && new Date(value.expiresAt) < new Date();
  const isRevoked = !!value.retractedAt;

  const copyPublicKey = async () => {
    await navigator.clipboard.writeText(value.publicKeyArmored);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`border border-surface-border overflow-hidden ${
        isRevoked
          ? "opacity-60 border-l-4 border-l-red-500"
          : isExpired
            ? "opacity-60 border-l-4 border-l-yellow-500"
            : ""
      }`}
    >
      {/* Full-width status banner */}
      {(isRevoked || isExpired) && (
        <div
          className={`w-full px-4 py-2 text-sm font-semibold ${
            isRevoked
              ? "bg-red-500/10 text-red-400"
              : "bg-yellow-500/10 text-yellow-400"
          }`}
        >
          {isRevoked ? KEYS.retracted : KEYS.expired}
        </div>
      )}

      {/* Padded content */}
      <div className="p-4">
        {/* Header */}
        <div className="mb-0 pb-3 border-b border-surface-border">
          {/* Title row */}
          <div className="flex items-center gap-2 pb-1 border-b border-surface-border">
            <span className="text-xl shrink-0">{icon}</span>
            <span className="font-semibold">{typeLabel}</span>
            {value.label && (
              <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs">
                {value.label}
              </span>
            )}
          </div>
          {/* Description */}
          {value.comment && (
            <p className="text-sm text-muted mt-1 mb-0">{value.comment}</p>
          )}
          {/* Fingerprint */}
          {value.fingerprint && (
            <div className="text-xs mt-2">
              <span className="text-muted">{KEYS.fingerprint}</span>{" "}
              <code className="font-mono bg-page px-1.5 py-0.5 border border-surface-border break-all">
                {value.fingerprint}
              </code>
            </div>
          )}
          {/* Dates */}
          <div className="flex gap-4 text-xs text-muted mt-2">
            <span>{KEYS.published} {formatDate(value.createdAt)}</span>
            {value.expiresAt && (
              <span
                className={isExpired ? "text-yellow-400 font-semibold" : ""}
              >
                {isExpired ? KEYS.expired : KEYS.expires}{" "}
                {formatDate(value.expiresAt)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="text-xs text-accent bg-transparent border-none cursor-pointer hover:underline p-0"
          >
            {expanded ? KEYS.hidePublicKey : KEYS.showPublicKey}
          </button>
          <button
            onClick={copyPublicKey}
            className="text-xs text-accent bg-transparent border-none cursor-pointer hover:underline p-0"
          >
            {copied ? PROFILE.copied : KEYS.copyPublicKey}
          </button>
        </div>

        {/* Expanded Key Content */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-surface-border">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-page p-3 border border-surface-border overflow-x-auto max-h-64 overflow-y-auto m-0">
              {value.publicKeyArmored}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
