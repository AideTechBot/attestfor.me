import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  listProofs,
  publishProof,
  deleteProof,
  listKeys,
  publishKey,
  deleteKey,
  parseAtUri,
} from "@/lib/atproto";
import type { AtProtoRecord } from "@/lib/atproto";
import type { MeAttestProof, MeAttestKey } from "../../types/lexicons";
import {
  AddProofWizard,
  type PendingProof,
} from "@/components/Profile/AddProofWizard";
import { EditProofList } from "@/components/Profile/EditProofList";
import {
  AddKeyWizard,
  type PendingKey,
} from "@/components/Profile/AddKeyWizard";
import { EditKeyList } from "@/components/Profile/EditKeyList";

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

export function EditProfilePage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<"proofs" | "keys">("proofs");

  // Preload openpgp when this page is first visited so it's ready before the user needs it
  useEffect(() => {
    import("openpgp");
  }, []);

  // ── Fetch live proofs ──────────────────────────────────────────────
  const {
    data: existingProofs = [],
    isLoading: proofsLoading,
    error: proofsError,
    refetch: refetchProofs,
  } = useQuery<AtProtoRecord<MeAttestProof.Main>[]>({
    queryKey: ["proofs", session?.did],
    queryFn: () => listProofs(session!.did!),
    enabled: !!session?.did,
  });

  // ── Fetch live keys ───────────────────────────────────────────────
  const {
    data: existingKeys = [],
    isLoading: keysLoading,
    error: keysError,
    refetch: refetchKeys,
  } = useQuery<AtProtoRecord<MeAttestKey.Main>[]>({
    queryKey: ["keys", session?.did],
    queryFn: () => listKeys(session!.did!),
    enabled: !!session?.did,
  });

  // ── Proof edit state ──────────────────────────────────────────────
  const [proofsToDelete, setProofsToDelete] = useState<Set<string>>(new Set());
  const [proofsToAdd, setProofsToAdd] = useState<PendingProof[]>([]);
  const [showProofWizard, setShowProofWizard] = useState(false);

  // ── Key edit state ────────────────────────────────────────────────
  const [keysToDelete, setKeysToDelete] = useState<Set<string>>(new Set());
  const [keysToAdd, setKeysToAdd] = useState<PendingKey[]>([]);
  const [showKeyWizard, setShowKeyWizard] = useState(false);

  const [saving, setSaving] = useState(false);

  const isDirty =
    proofsToDelete.size > 0 ||
    proofsToAdd.length > 0 ||
    keysToDelete.size > 0 ||
    keysToAdd.length > 0;

  // ── Proof handlers ────────────────────────────────────────────────

  const handleToggleDeleteProof = (uri: string) => {
    setProofsToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleRemoveAddProof = (tempId: string) => {
    setProofsToAdd((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleAddProof = (proof: PendingProof) => {
    setProofsToAdd((prev) => [...prev, proof]);
    setShowProofWizard(false);
  };

  // ── Key handlers ──────────────────────────────────────────────────

  const handleToggleDeleteKey = (uri: string) => {
    setKeysToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleRemoveAddKey = (tempId: string) => {
    setKeysToAdd((prev) => prev.filter((k) => k.tempId !== tempId));
  };

  const handleAddKey = (key: PendingKey) => {
    setKeysToAdd((prev) => [...prev, key]);
    setShowKeyWizard(false);
  };

  // ── Save ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);

    const ops = [
      ...[...proofsToDelete].map((uri) => {
        const { rkey } = parseAtUri(uri);
        return deleteProof(rkey).catch((e: unknown) => {
          throw new Error(
            `Failed to delete proof: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }),
      ...proofsToAdd.map((p) =>
        publishProof(p.record).catch((e: unknown) => {
          throw new Error(
            `Failed to publish proof: ${e instanceof Error ? e.message : String(e)}`,
          );
        }),
      ),
      ...[...keysToDelete].map((uri) => {
        const { rkey } = parseAtUri(uri);
        return deleteKey(rkey).catch((e: unknown) => {
          throw new Error(
            `Failed to delete key: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }),
      ...keysToAdd.map((k) =>
        publishKey(k.record).catch((e: unknown) => {
          throw new Error(
            `Failed to publish key: ${e instanceof Error ? e.message : String(e)}`,
          );
        }),
      ),
    ];

    try {
      await Promise.all(ops);
      toast.success("Changes saved successfully.");
      setProofsToDelete(new Set());
      setProofsToAdd([]);
      setKeysToDelete(new Set());
      setKeysToAdd([]);
      await Promise.all([refetchProofs(), refetchKeys()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setProofsToDelete(new Set());
    setProofsToAdd([]);
    setShowProofWizard(false);
    setKeysToDelete(new Set());
    setKeysToAdd([]);
    setShowKeyWizard(false);
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
          <ArrowLeft className="w-3.5 h-3.5 inline" /> Back
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  const anyWizardOpen = showProofWizard || showKeyWizard;

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
      {/* Back link */}
      <Link
        to={`/@${session.handle}/details`}
        className="-mx-6 -mt-6 flex items-center mb-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors no-underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </Link>

      <h1 className="text-lg font-semibold m-0">Edit profile</h1>

      {/* ── Tabs ── */}
      <div className="flex border-b border-surface-border">
        {(["proofs", "keys"] as const).map((tab) => {
          const pendingCount =
            tab === "proofs"
              ? proofsToAdd.length + proofsToDelete.size
              : keysToAdd.length + keysToDelete.size;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px capitalize ${
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              {tab}
              {pendingCount > 0 && (
                <span className="ml-1.5 text-xs bg-accent/20 text-accent px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Proofs tab ── */}
      {activeTab === "proofs" && (
        <>
          {proofsLoading ? (
            <div className="text-xs text-muted py-4 text-center">
              Loading proofs…
            </div>
          ) : proofsError ? (
            <div className="text-xs text-red-400 py-4 text-center">
              Failed to load proofs.{" "}
              <button
                onClick={() => void refetchProofs()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <EditProofList
              existing={existingProofs}
              toDelete={proofsToDelete}
              toAdd={proofsToAdd}
              onToggleDelete={handleToggleDeleteProof}
              onRemoveAdd={handleRemoveAddProof}
            />
          )}

          {!showProofWizard && (
            <button
              onClick={() => setShowProofWizard(true)}
              className="w-full py-2.5 text-sm border border-dashed border-surface-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
            >
              + Add proof
            </button>
          )}
        </>
      )}

      {/* ── Keys tab ── */}
      {activeTab === "keys" && (
        <>
          {keysLoading ? (
            <div className="text-xs text-muted py-4 text-center">
              Loading keys…
            </div>
          ) : keysError ? (
            <div className="text-xs text-red-400 py-4 text-center">
              Failed to load keys.{" "}
              <button
                onClick={() => void refetchKeys()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <EditKeyList
              existing={existingKeys}
              toDelete={keysToDelete}
              toAdd={keysToAdd}
              onToggleDelete={handleToggleDeleteKey}
              onRemoveAdd={handleRemoveAddKey}
            />
          )}

          {!showKeyWizard && (
            <button
              onClick={() => setShowKeyWizard(true)}
              className="w-full py-2.5 text-sm border border-dashed border-surface-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
            >
              + Add key
            </button>
          )}
        </>
      )}

      {/* ── Proof wizard modal ── */}
      {showProofWizard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-wizard-title"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowProofWizard(false)}
          />
          <div className="relative z-10 w-full max-w-[400px]">
            <AddProofWizard
              did={session.did!}
              handle={session.handle!}
              onAdd={handleAddProof}
              onCancel={() => setShowProofWizard(false)}
            />
          </div>
        </div>
      )}

      {/* ── Key wizard modal ── */}
      {showKeyWizard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="key-wizard-title"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowKeyWizard(false)}
          />
          <div className="relative z-10 w-full max-w-[400px]">
            <AddKeyWizard
              onAdd={handleAddKey}
              onCancel={() => setShowKeyWizard(false)}
            />
          </div>
        </div>
      )}

      {/* ── Save / discard ── */}
      {isDirty && !anyWizardOpen && (
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              `Save changes (${proofsToAdd.length + proofsToDelete.size + keysToAdd.length + keysToDelete.size})`
            )}
          </button>
        </div>
      )}

      {/* ── Pending summary ── */}
      {isDirty && !anyWizardOpen && (
        <div className="text-xs text-muted space-y-0.5">
          {proofsToAdd.length > 0 && (
            <div className="text-green-400">
              + {proofsToAdd.length} proof{proofsToAdd.length !== 1 ? "s" : ""}{" "}
              to add
            </div>
          )}
          {proofsToDelete.size > 0 && (
            <div className="text-red-400">
              − {proofsToDelete.size} proof
              {proofsToDelete.size !== 1 ? "s" : ""} to delete
            </div>
          )}
          {keysToAdd.length > 0 && (
            <div className="text-green-400">
              + {keysToAdd.length} key{keysToAdd.length !== 1 ? "s" : ""} to add
            </div>
          )}
          {keysToDelete.size > 0 && (
            <div className="text-red-400">
              − {keysToDelete.size} key{keysToDelete.size !== 1 ? "s" : ""} to
              delete
            </div>
          )}
        </div>
      )}
    </div>
  );
}
