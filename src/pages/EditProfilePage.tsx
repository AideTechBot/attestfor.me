import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  listClaims,
  publishClaim,
  deleteClaim,
  listKeys,
  publishKey,
  deleteKey,
  retractKey,
  parseAtUri,
} from "@/lib/atproto";
import type { AtProtoRecord } from "@/lib/atproto";
import type {
  DevKeytraceClaim,
  DevKeytraceUserPublicKey,
} from "../../types/keytrace";
import {
  AddClaimWizard,
  type PendingClaim,
} from "@/components/Profile/AddClaimWizard";
import { EditClaimList } from "@/components/Profile/EditClaimList";
import {
  AddKeyWizard,
  type PendingKey,
} from "@/components/Profile/AddKeyWizard";
import { EditKeyList } from "@/components/Profile/EditKeyList";
import {
  NAV,
  AUTH,
  LOADING,
  ERRORS,
  SUCCESS,
  CLAIMS,
  KEYS,
  EDIT_PROFILE,
} from "@/lib/ui-strings";

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
  const [activeTab, setActiveTab] = useState<"claims" | "keys">("claims");

  // Preload openpgp when this page is first visited so it's ready before the user needs it
  useEffect(() => {
    import("openpgp");
  }, []);

  // ── Fetch live claims ──────────────────────────────────────────────
  const {
    data: existingClaims = [],
    isLoading: claimsLoading,
    error: claimsError,
    refetch: refetchClaims,
  } = useQuery<AtProtoRecord<DevKeytraceClaim.Main>[]>({
    queryKey: ["claims", session?.did],
    queryFn: () => listClaims(session!.did!),
    enabled: !!session?.did,
  });

  // ── Fetch live keys ───────────────────────────────────────────────
  const {
    data: existingKeys = [],
    isLoading: keysLoading,
    error: keysError,
    refetch: refetchKeys,
  } = useQuery<AtProtoRecord<DevKeytraceUserPublicKey.Main>[]>({
    queryKey: ["keys", session?.did],
    queryFn: () => listKeys(session!.did!),
    enabled: !!session?.did,
  });

  // ── Claim edit state ──────────────────────────────────────────────
  const [claimsToDelete, setClaimsToDelete] = useState<Set<string>>(new Set());
  const [claimsToAdd, setClaimsToAdd] = useState<PendingClaim[]>([]);
  const [showClaimWizard, setShowClaimWizard] = useState(false);

  // ── Key edit state ────────────────────────────────────────────────
  const [keysToDelete, setKeysToDelete] = useState<Set<string>>(new Set());
  const [keysToRetract, setKeysToRetract] = useState<Set<string>>(new Set());
  const [keysToAdd, setKeysToAdd] = useState<PendingKey[]>([]);
  const [showKeyWizard, setShowKeyWizard] = useState(false);

  const [saving, setSaving] = useState(false);

  const isDirty =
    claimsToDelete.size > 0 ||
    claimsToAdd.length > 0 ||
    keysToDelete.size > 0 ||
    keysToRetract.size > 0 ||
    keysToAdd.length > 0;

  // ── Claim handlers ────────────────────────────────────────────────

  const handleToggleDeleteClaim = (uri: string) => {
    setClaimsToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleRemoveAddClaim = (tempId: string) => {
    setClaimsToAdd((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleAddClaim = (pending: PendingClaim) => {
    setClaimsToAdd((prev) => [...prev, pending]);
    setShowClaimWizard(false);
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

  const handleToggleRetractKey = (uri: string) => {
    setKeysToRetract((prev) => {
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
      ...[...claimsToDelete].map((uri) => {
        const { rkey } = parseAtUri(uri);
        return deleteClaim(rkey).catch((e: unknown) => {
          throw new Error(
            `Failed to delete claim: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }),
      ...claimsToAdd.map((p) =>
        publishClaim(p.record).catch((e: unknown) => {
          throw new Error(
            `Failed to publish claim: ${e instanceof Error ? e.message : String(e)}`,
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
      ...[...keysToRetract].map((uri) => {
        const record = existingKeys.find((k) => k.uri === uri);
        if (!record) {
          return Promise.resolve();
        }
        return retractKey(record).catch((e: unknown) => {
          throw new Error(
            `Failed to retract key: ${e instanceof Error ? e.message : String(e)}`,
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
      toast.success(SUCCESS.changesSaved);
      setClaimsToDelete(new Set());
      setClaimsToAdd([]);
      setKeysToDelete(new Set());
      setKeysToRetract(new Set());
      setKeysToAdd([]);
      await Promise.all([refetchClaims(), refetchKeys()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ERRORS.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setClaimsToDelete(new Set());
    setClaimsToAdd([]);
    setShowClaimWizard(false);
    setKeysToDelete(new Set());
    setKeysToRetract(new Set());
    setKeysToAdd([]);
    setShowKeyWizard(false);
  };

  // ── Auth guard ────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted text-sm">
        {LOADING.loading}
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted text-sm">{AUTH.mustBeSignedIn}</p>
        <Link to="/" className="text-xs text-accent hover:underline">
          <ArrowLeft className="w-3.5 h-3.5 inline" /> {NAV.back}
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  const anyWizardOpen = showClaimWizard || showKeyWizard;

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
      {/* Back link */}
      <Link
        to={`/${session.handle}/details`}
        className="-mx-6 -mt-6 flex items-center mb-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors no-underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {NAV.backToProfile}
      </Link>

      <h1 className="text-lg font-semibold m-0">{EDIT_PROFILE.title}</h1>

      {/* ── Tabs ── */}
      <div className="flex border-b border-surface-border">
        {(["claims", "keys"] as const).map((tab) => {
          const pendingCount =
            tab === "claims"
              ? claimsToAdd.length + claimsToDelete.size
              : keysToAdd.length + keysToDelete.size + keysToRetract.size;
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

      {/* ── Claims tab ── */}
      {activeTab === "claims" && (
        <>
          {claimsLoading ? (
            <div className="text-xs text-muted py-4 text-center">
              {LOADING.loadingClaims}
            </div>
          ) : claimsError ? (
            <div className="text-xs text-red-400 py-4 text-center">
              {ERRORS.failedToLoadClaims}{" "}
              <button
                onClick={() => void refetchClaims()}
                className="underline hover:no-underline"
              >
                {NAV.retry}
              </button>
            </div>
          ) : (
            <EditClaimList
              existing={existingClaims}
              toDelete={claimsToDelete}
              toAdd={claimsToAdd}
              onToggleDelete={handleToggleDeleteClaim}
              onRemoveAdd={handleRemoveAddClaim}
            />
          )}

          {!showClaimWizard && (
            <button
              onClick={() => setShowClaimWizard(true)}
              className="w-full py-2.5 text-sm border border-dashed border-surface-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
            >
              {CLAIMS.addClaim}
            </button>
          )}
        </>
      )}

      {/* ── Keys tab ── */}
      {activeTab === "keys" && (
        <>
          {keysLoading ? (
            <div className="text-xs text-muted py-4 text-center">
              {LOADING.loadingKeys}
            </div>
          ) : keysError ? (
            <div className="text-xs text-red-400 py-4 text-center">
              {ERRORS.failedToLoadKeys}{" "}
              <button
                onClick={() => void refetchKeys()}
                className="underline hover:no-underline"
              >
                {NAV.retry}
              </button>
            </div>
          ) : (
            <EditKeyList
              existing={existingKeys}
              toDelete={keysToDelete}
              toRetract={keysToRetract}
              toAdd={keysToAdd}
              onToggleDelete={handleToggleDeleteKey}
              onToggleRetract={handleToggleRetractKey}
              onRemoveAdd={handleRemoveAddKey}
            />
          )}

          {!showKeyWizard && (
            <button
              onClick={() => setShowKeyWizard(true)}
              className="w-full py-2.5 text-sm border border-dashed border-surface-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
            >
              {KEYS.addKey}
            </button>
          )}
        </>
      )}

      {/* ── Claim wizard modal ── */}
      {showClaimWizard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-wizard-title"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowClaimWizard(false)}
          />
          <div className="relative z-10 w-full max-w-[400px]">
            <AddClaimWizard
              did={session.did!}
              handle={session.handle!}
              onAdd={handleAddClaim}
              onCancel={() => setShowClaimWizard(false)}
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
            {NAV.discard}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {NAV.saving}
              </>
            ) : (
              EDIT_PROFILE.saveChanges(claimsToAdd.length + claimsToDelete.size + keysToAdd.length + keysToDelete.size + keysToRetract.size)
            )}
          </button>
        </div>
      )}

      {/* ── Pending summary ── */}
      {isDirty && !anyWizardOpen && (
        <div className="text-xs text-muted space-y-0.5">
          {claimsToAdd.length > 0 && (
            <div className="text-green-400">
              {EDIT_PROFILE.claimsToAdd(claimsToAdd.length)}
            </div>
          )}
          {claimsToDelete.size > 0 && (
            <div className="text-red-400">
              {EDIT_PROFILE.claimsToDelete(claimsToDelete.size)}
            </div>
          )}
          {keysToAdd.length > 0 && (
            <div className="text-green-400">
              {EDIT_PROFILE.keysToAdd(keysToAdd.length)}
            </div>
          )}
          {keysToRetract.size > 0 && (
            <div className="text-orange-400">
              {EDIT_PROFILE.keysToRetract(keysToRetract.size)}
            </div>
          )}
          {keysToDelete.size > 0 && (
            <div className="text-red-400">
              {EDIT_PROFILE.keysToDelete(keysToDelete.size)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
