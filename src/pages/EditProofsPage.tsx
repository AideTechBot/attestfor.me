import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  listProofs,
  publishProof,
  deleteProof,
  parseAtUri,
} from "@/lib/atproto";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof } from "../../types/lexicons";
import {
  AddProofWizard,
  type PendingProof,
} from "@/components/Profile/AddProofWizard";
import { EditProofList } from "@/components/Profile/EditProofList";

interface SessionData {
  authenticated: boolean;
  handle?: string;
  did?: string;
  displayName?: string;
}

function useSession() {
  return useQuery<SessionData>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
    staleTime: 30_000,
  });
}

export function EditProofsPage() {
  const { data: session, isLoading: sessionLoading } = useSession();

  // ── Fetch live proofs ──────────────────────────────────────────────
  const {
    data: existingProofs = [],
    isLoading: proofsLoading,
    error: proofsError,
    refetch,
  } = useQuery<AtProtoRecord<MeAttestProof.Main>[]>({
    queryKey: ["proofs", session?.did],
    queryFn: () => listProofs(session!.did!),
    enabled: !!session?.did,
  });

  // ── Edit state ────────────────────────────────────────────────────
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [toAdd, setToAdd] = useState<PendingProof[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = toDelete.size > 0 || toAdd.length > 0;

  // ── Handlers ──────────────────────────────────────────────────────

  const handleToggleDelete = (uri: string) => {
    setToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleRemoveAdd = (tempId: string) => {
    setToAdd((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleAddProof = (proof: PendingProof) => {
    setToAdd((prev) => [...prev, proof]);
    setShowWizard(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const deleteOps = [...toDelete].map((uri) => {
      const { rkey } = parseAtUri(uri);
      return deleteProof(rkey).catch((e: unknown) => {
        throw new Error(
          `Failed to delete proof: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    });

    const createOps = toAdd.map((pending) =>
      publishProof(pending.record).catch((e: unknown) => {
        throw new Error(
          `Failed to publish proof: ${e instanceof Error ? e.message : String(e)}`,
        );
      }),
    );

    try {
      await Promise.all([...deleteOps, ...createOps]);
      toast.success("Changes saved successfully.");
      setToDelete(new Set());
      setToAdd([]);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setToDelete(new Set());
    setToAdd([]);
    setShowWizard(false);
  };

  // ── Auth guard ────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted text-sm">
          You must be signed in to edit proofs.
        </p>
        <Link to="/" className="text-xs text-accent hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
      {/* Back link */}
      <Link
        to={`/@${session.handle}`}
        className="-mx-6 -mt-6 flex items-center mb-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors no-underline"
      >
        ← Back to profile
      </Link>

      <h1 className="text-lg font-semibold m-0">Edit proofs</h1>

      {/* Proof list */}
      {proofsLoading ? (
        <div className="text-xs text-muted py-4 text-center">
          Loading proofs…
        </div>
      ) : proofsError ? (
        <div className="text-xs text-red-400 py-4 text-center">
          Failed to load proofs.{" "}
          <button
            onClick={() => void refetch()}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <EditProofList
          existing={existingProofs}
          toDelete={toDelete}
          toAdd={toAdd}
          onToggleDelete={handleToggleDelete}
          onRemoveAdd={handleRemoveAdd}
        />
      )}

      {/* Add proof wizard — rendered as a floating modal */}
      {showWizard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowWizard(false)}
          />
          {/* Panel */}
          <div className="relative z-10 w-full max-w-[400px]">
            <AddProofWizard
              did={session.did!}
              handle={session.handle!}
              onAdd={handleAddProof}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </div>
      )}

      {/* Add proof button */}
      {!showWizard && (
        <button
          onClick={() => setShowWizard(true)}
          className="w-full py-2.5 text-sm border border-dashed border-surface-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
        >
          + Add proof
        </button>
      )}

      {/* Save / discard */}
      {isDirty && !showWizard && (
        <div className="flex gap-2 pt-2 border-t border-surface-border">
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="flex-1 py-2.5 text-sm border border-surface-border hover:border-muted transition-colors bg-transparent disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
          >
            {saving ? (
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
                Saving…
              </>
            ) : (
              `Save changes (${toAdd.length + toDelete.size})`
            )}
          </button>
        </div>
      )}

      {/* Summary of pending changes */}
      {isDirty && !showWizard && (
        <div className="text-xs text-muted space-y-0.5">
          {toAdd.length > 0 && (
            <div className="text-green-400">
              + {toAdd.length} proof{toAdd.length !== 1 ? "s" : ""} to add
            </div>
          )}
          {toDelete.size > 0 && (
            <div className="text-red-400">
              − {toDelete.size} proof{toDelete.size !== 1 ? "s" : ""} to delete
            </div>
          )}
        </div>
      )}
    </div>
  );
}
