import { useState } from "react";
import { KeyRound, AlertTriangle } from "lucide-react";
import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceUserPublicKey } from "../../../types/keytrace";
import type { PendingKey } from "./AddKeyWizard";
import { KEY_TYPE_LABELS } from "@/lib/global-features";
import { NAV, KEYS, KEY_RETRACT, CLAIMS, EDIT_LIST } from "@/lib/ui-strings";

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
              {KEY_RETRACT.title}
            </div>
            <div className="text-xs text-muted mt-1">
              {KEY_RETRACT.warning(keyLabel)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm border border-surface-border text-muted hover:text-white hover:border-muted transition-colors bg-transparent"
          >
            {NAV.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm border border-orange-500/60 text-orange-400 hover:bg-orange-500/10 transition-colors font-semibold"
          >
            {KEY_RETRACT.confirm}
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
          <div className="text-sm text-muted">{EDIT_LIST.noKeysYet}</div>
          <div className="text-xs text-muted/60">{EDIT_LIST.addOneBelow}</div>
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
                  {CLAIMS.willDelete}
                </span>
              )}
              {stagedRetract && (
                <span className="text-xs text-orange-400 font-semibold shrink-0">
                  {KEYS.willRetract}
                </span>
              )}
              {!staged && (
                <button
                  onClick={() => handleRetractClick(key.uri)}
                  title="Retract key (permanent)"
                  className="shrink-0 text-xs px-2 py-1 border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors"
                >
                  {KEYS.retract}
                </button>
              )}
              {stagedRetract && (
                <button
                  onClick={() => onToggleRetract(key.uri)}
                  title="Undo retract"
                  className="shrink-0 text-xs px-2 py-1 border border-surface-border text-muted hover:border-accent hover:text-white transition-colors"
                >
                  {CLAIMS.undo}
                </button>
              )}
              {!staged && (
                <button
                  onClick={() => onToggleDelete(key.uri)}
                  title="Delete key"
                  className="shrink-0 text-xs px-2 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {CLAIMS.delete}
                </button>
              )}
              {stagedDelete && (
                <button
                  onClick={() => onToggleDelete(key.uri)}
                  title="Undo delete"
                  className="shrink-0 text-xs px-2 py-1 border border-surface-border text-muted hover:border-accent hover:text-white transition-colors"
                >
                  {CLAIMS.undo}
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
                    · {CLAIMS.retracted}
                  </span>
                </div>
              </div>
              {staged && (
                <span className="text-xs text-red-400 font-semibold shrink-0">
                  {CLAIMS.willDelete}
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
                {staged ? CLAIMS.undo : CLAIMS.delete}
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
              {CLAIMS.new}
            </span>
            <button
              onClick={() => onRemoveAdd(pending.tempId)}
              title="Remove"
              className="shrink-0 text-xs px-2 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              {CLAIMS.remove}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
