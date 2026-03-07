import type { AtProtoRecord } from "@/lib/atproto";
import type { DevKeytraceClaim } from "../../../types/keytrace";
import { ServiceIcon } from "./ServiceIcon";
import { SERVICE_NAMES } from "@/lib/global-features";
import type { PendingClaim } from "./AddClaimWizard";
import { CLAIMS, EDIT_LIST } from "@/lib/ui-strings";

interface EditClaimListProps {
  /** Existing claims fetched from the repo */
  existing: AtProtoRecord<DevKeytraceClaim.Main>[];
  /** URIs of existing claims staged for deletion */
  toDelete: Set<string>;
  /** New claims staged for creation */
  toAdd: PendingClaim[];
  onToggleDelete: (uri: string) => void;
  onRemoveAdd: (tempId: string) => void;
}

export function EditClaimList({
  existing,
  toDelete,
  toAdd,
  onToggleDelete,
  onRemoveAdd,
}: EditClaimListProps) {
  const active = existing.filter((p) => !p.value.retractedAt);
  const retracted = existing.filter((p) => !!p.value.retractedAt);

  if (active.length === 0 && retracted.length === 0 && toAdd.length === 0) {
    return (
      <div className="flex items-center justify-center px-3 py-2.5 border border-transparent">
        <div className="flex flex-col items-center">
          <div className="text-sm text-muted">{EDIT_LIST.noClaimsYet}</div>
          <div className="text-xs text-muted/60">{EDIT_LIST.addOneBelow}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Existing active claims ── */}
      {active.map((claim) => {
        const staged = toDelete.has(claim.uri);
        return (
          <div
            key={claim.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border"
            }`}
          >
            <ServiceIcon service={claim.value.type} size={18} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {SERVICE_NAMES[claim.value.type] ?? claim.value.type}
              </div>
              <div className="text-xs text-muted truncate">
                {claim.value.identity.subject}
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                {CLAIMS.willDelete}
              </span>
            )}
            <button
              onClick={() => onToggleDelete(claim.uri)}
              title={staged ? "Undo delete" : "Delete claim"}
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

      {/* ── Retracted claims (read-only, can still delete record) ── */}
      {retracted.map((claim) => {
        const staged = toDelete.has(claim.uri);
        return (
          <div
            key={claim.uri}
            className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
              staged
                ? "border-red-500/40 bg-red-500/5 opacity-60"
                : "border-surface-border opacity-50"
            }`}
          >
            <ServiceIcon service={claim.value.type} size={18} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {SERVICE_NAMES[claim.value.type] ?? claim.value.type}
              </div>
              <div className="text-xs text-muted truncate">
                {claim.value.identity.subject}
                <span className="ml-2 text-red-400/70">· {CLAIMS.retracted}</span>
              </div>
            </div>
            {staged && (
              <span className="text-xs text-red-400 font-semibold shrink-0">
                {CLAIMS.willDelete}
              </span>
            )}
            <button
              onClick={() => onToggleDelete(claim.uri)}
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
          <ServiceIcon service={pending.record.type} size={18} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {SERVICE_NAMES[pending.record.type] ?? pending.record.type}
            </div>
            <div className="text-xs text-muted truncate">
              {pending.record.identity.subject}
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
  );
}
