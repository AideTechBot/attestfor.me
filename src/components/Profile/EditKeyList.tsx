import { useState } from "react";
import { KeyRound, AlertTriangle } from "lucide-react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceUserPublicKey } from "../../../types/keytrace";
import type { PendingKey } from "./AddKeyWizard";
import { KEY_TYPE_LABELS } from "@/lib/global-features";

interface EditKeyListProps {
  existing: AtProtoRecord<DevKeytraceUserPublicKey.Main>[];
  toDelete: Set<string>;
  toRetract: Set<string>;
  toAdd: PendingKey[];
  onToggleDelete: (uri: string) => void;
  onToggleRetract: (uri: string) => void;
  onRemoveAdd: (tempId: string) => void;
}

function RetractConfirmDialog({
  keyLabel,
  onConfirm,
  onCancel,
}: {
  keyLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-surface-border p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-white">
              Retract this key?
            </div>
            <div className="text-xs text-muted mt-1">
              <span className="font-semibold text-white/80">{keyLabel}</span>{" "}
              will be permanently marked as retracted. This cannot be undone.
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm border border-surface-border text-muted hover:text-white hover:border-muted transition-colors bg-transparent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm border border-orange-500/60 text-orange-400 hover:bg-orange-500/10 transition-colors font-semibold"
          >
            Yes, retract permanently
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditKeyList({
  existing,
  toDelete,
  toRetract,
  toAdd,
  onToggleDelete,
  onToggleRetract,
  onRemoveAdd,
}: EditKeyListProps) {
  const [confirmRetractUri, setConfirmRetractUri] = useState<string | null>(
    null,
  );

  const active = existing.filter((k) => !k.value.retractedAt);
  const retracted = existing.filter((k) => !!k.value.retractedAt);

  const handleRetractClick = (uri: string) => {
    if (toRetract.has(uri)) {
      onToggleRetract(uri);
    } else {
      setConfirmRetractUri(uri);
    }
  };

  const handleConfirmRetract = () => {
    if (confirmRetractUri) {
      onToggleRetract(confirmRetractUri);
      setConfirmRetractUri(null);
    }
  };

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

  const confirmKey = confirmRetractUri
    ? existing.find((k) => k.uri === confirmRetractUri)
    : null;

  return (
    <>
      {confirmRetractUri && confirmKey && (
        <RetractConfirmDialog
          keyLabel={
            confirmKey.value.label ||
            (KEY_TYPE_LABELS[confirmKey.value.keyType] ??
              confirmKey.value.keyType)
          }
          onConfirm={handleConfirmRetract}
          onCancel={() => setConfirmRetractUri(null)}
        />
      )}

      <div className="flex flex-col gap-2">
        {/* ── Existing active keys ── */}
        {active.map((key) => {
          const stagedDelete = toDelete.has(key.uri);
          const stagedRetract = toRetract.has(key.uri);
          const staged = stagedDelete || stagedRetract;

          return (
            <div
              key={key.uri}
              className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
                stagedDelete
                  ? "border-red-500/40 bg-red-500/5 opacity-60"
                  : stagedRetract
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-surface-border"
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
                </div>
              </div>
              {stagedDelete && (
                <span className="text-xs text-red-400 font-semibold shrink-0">
                  will delete
                </span>
              )}
              {stagedRetract && (
                <span className="text-xs text-orange-400 font-semibold shrink-0">
                  will retract
                </span>
              )}
              {!staged && (
                <button
                  onClick={() => handleRetractClick(key.uri)}
                  title="Retract key (permanent)"
                  className="shrink-0 text-xs px-2 py-1 border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  Retract
                </button>
              )}
              {stagedRetract && (
                <button
                  onClick={() => onToggleRetract(key.uri)}
                  title="Undo retract"
                  className="shrink-0 text-xs px-2 py-1 border border-surface-border text-muted hover:border-accent hover:text-white transition-colors"
                >
                  Undo
                </button>
              )}
              {!staged && (
                <button
                  onClick={() => onToggleDelete(key.uri)}
                  title="Delete key"
                  className="shrink-0 text-xs px-2 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              )}
              {stagedDelete && (
                <button
                  onClick={() => onToggleDelete(key.uri)}
                  title="Undo delete"
                  className="shrink-0 text-xs px-2 py-1 border border-surface-border text-muted hover:border-accent hover:text-white transition-colors"
                >
                  Undo
                </button>
              )}
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
                  <span className="ml-2 text-orange-400/70 font-sans">
                    · retracted
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
    </>
  );
}
