import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../../types/lexicons";
import { ServiceIcon } from "./ServiceIcon";
import { SERVICE_NAMES } from "@/lib/service-names";
import type { PendingProof } from "./AddProofWizard";

interface EditProofListProps {
  /** Existing proofs fetched from the repo */
  existing: AtProtoRecord<MeAttestProof.Main>[];
  /** URIs of existing proofs staged for deletion */
  toDelete: Set<string>;
  /** New proofs staged for creation */
  toAdd: PendingProof[];
  onToggleDelete: (uri: string) => void;
  onRemoveAdd: (tempId: string) => void;
}

export function EditProofList({
  existing,
  toDelete,
  toAdd,
  onToggleDelete,
  onRemoveAdd,
}: EditProofListProps) {
  const active = existing.filter((p) => p.value.status !== "retracted");
  const retracted = existing.filter((p) => p.value.status === "retracted");

  if (active.length === 0 && retracted.length === 0 && toAdd.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        No proofs yet. Add one below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Existing active proofs ── */}
      {active.map((proof) => {
        const staged = toDelete.has(proof.uri);
        return (
          <div
            key={proof.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border"
            }`}
          >
            <ServiceIcon service={proof.value.service} size={18} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {SERVICE_NAMES[proof.value.service] ?? proof.value.service}
              </div>
              <div className="text-xs text-muted truncate">
                {proof.value.handle}
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                will delete
              </span>
            )}
            <button
              onClick={() => onToggleDelete(proof.uri)}
              title={staged ? "Undo delete" : "Delete proof"}
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

      {/* ── Retracted proofs (read-only, can still delete record) ── */}
      {retracted.map((proof) => {
        const staged = toDelete.has(proof.uri);
        return (
          <div
            key={proof.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border opacity-50"
            }`}
          >
            <ServiceIcon service={proof.value.service} size={18} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {SERVICE_NAMES[proof.value.service] ?? proof.value.service}
              </div>
              <div className="text-xs text-muted truncate">
                {proof.value.handle}
                <span className="ml-2 text-red-400/70">· retracted</span>
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                will delete
              </span>
            )}
            <button
              onClick={() => onToggleDelete(proof.uri)}
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
          <ServiceIcon service={pending.record.service} size={18} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {SERVICE_NAMES[pending.record.service] ?? pending.record.service}
            </div>
            <div className="text-xs text-muted truncate">
              {pending.record.handle}
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
