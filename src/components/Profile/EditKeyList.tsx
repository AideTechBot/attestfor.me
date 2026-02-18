import { KeyRound } from "lucide-react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestKey } from "../../../types/lexicons";
import type { PendingKey } from "./AddKeyWizard";
import { KEY_TYPE_LABELS } from "@/lib/global-features";

interface EditKeyListProps {
  existing: AtProtoRecord<MeAttestKey.Main>[];
  toDelete: Set<string>;
  toAdd: PendingKey[];
  onToggleDelete: (uri: string) => void;
  onRemoveAdd: (tempId: string) => void;
}

export function EditKeyList({
  existing,
  toDelete,
  toAdd,
  onToggleDelete,
  onRemoveAdd,
}: EditKeyListProps) {
  const active = existing.filter((k) => k.value.status !== "revoked");
  const retracted = existing.filter((k) => k.value.status === "revoked");

  if (active.length === 0 && retracted.length === 0 && toAdd.length === 0) {
    return (
      <div className="flex items-center justify-center px-3 py-2.5 border border-transparent">
        <div className="flex flex-col items-center">
          <div className="text-sm text-muted">No keys yet.</div>
          <div className="text-xs text-muted/60">Add one below.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Existing active keys ── */}
      {active.map((key) => {
        const staged = toDelete.has(key.uri);
        return (
          <div
            key={key.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border"
            }`}
          >
            {/* Key icon */}
            <KeyRound className="w-4 h-4 shrink-0 text-muted" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {key.value.label ||
                  (KEY_TYPE_LABELS[key.value.keyType] ?? key.value.keyType)}
              </div>
              <div className="text-xs text-muted font-mono truncate">
                {key.value.fingerprint}
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                will delete
              </span>
            )}
            <button
              onClick={() => onToggleDelete(key.uri)}
              title={staged ? "Undo delete" : "Delete key"}
              className={`shrink-0 text-xs px-2 py-1 border transition-colors ${
                staged
                  ? "border-surface-border text-muted hover:border-accent hover:text-white"
                  : "border-red-500/40 text-red-400 hover:bg-red-500/10"
              }`}
            >
              {staged ? "Undo" : "Delete"}
            </button>
          </div>
        );
      })}

      {/* ── Retracted keys (read-only) ── */}
      {retracted.map((key) => {
        const staged = toDelete.has(key.uri);
        return (
          <div
            key={key.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border opacity-50"
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0 text-muted" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {key.value.label ||
                  (KEY_TYPE_LABELS[key.value.keyType] ?? key.value.keyType)}
              </div>
              <div className="text-xs text-muted font-mono truncate">
                {key.value.fingerprint}
                <span className="ml-2 text-red-400/70 font-sans">
                  · revoked
                </span>
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                will delete
              </span>
            )}
            <button
              onClick={() => onToggleDelete(key.uri)}
              title={staged ? "Undo delete" : "Delete record"}
              className={`shrink-0 text-xs px-2 py-1 border transition-colors ${
                staged
                  ? "border-surface-border text-muted hover:border-accent hover:text-white"
                  : "border-red-500/40 text-red-400 hover:bg-red-500/10"
              }`}
            >
              {staged ? "Undo" : "Delete"}
            </button>
          </div>
        );
      })}

      {/* ── Pending additions ── */}
      {toAdd.map((pending) => (
        <div
          key={pending.tempId}
          className="flex items-center gap-3 px-3 py-2.5 border border-green-500/30 bg-green-500/5"
        >
          <KeyRound className="w-4 h-4 shrink-0 text-green-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {pending.record.label ||
                (KEY_TYPE_LABELS[pending.record.keyType] ??
                  pending.record.keyType)}
            </div>
            <div className="text-xs text-muted font-mono truncate">
              {pending.parsed.fingerprint}
            </div>
          </div>
          <span className="text-xs text-green-400 font-semibold shrink-0">
            new
          </span>
          <button
            onClick={() => onRemoveAdd(pending.tempId)}
            title="Remove"
            className="shrink-0 text-xs px-2 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
