import { useState, useCallback } from "react";
import { FileUp, KeyRound, ArrowRight } from "lucide-react";
import { WizardShell } from "./WizardShell";
import { parseKey, type ParsedKey } from "@/lib/key-parser";
import type { DevKeytraceUserPublicKey } from "../../../types/keytrace";
import { ids } from "../../../types/keytrace";
import { KEY_TYPE_LABELS } from "@/lib/global-features";
import { NAV, KEY_WIZARD, KEYS } from "@/lib/ui-strings";

// ── Types ──────────────────────────────────────────────────────────

export interface PendingKey {
  /** Temporary client-side id - not the final rkey */
  tempId: string;
  record: DevKeytraceUserPublicKey.Main;
  parsed: ParsedKey;
}

interface AddKeyWizardProps {
  onAdd: (key: PendingKey) => void;
  onCancel: () => void;
}

type Step = "enter-key" | "done";

// ── Component ──────────────────────────────────────────────────────

export function AddKeyWizard({ onAdd, onCancel }: AddKeyWizardProps) {
  const [step, setStep] = useState<Step>("enter-key");
  const [rawKey, setRawKey] = useState("");
  const [label, setLabel] = useState("");
  const [parsed, setParsed] = useState<ParsedKey | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<PendingKey | null>(null);

  const handleKeyChange = useCallback(async (value: string) => {
    setRawKey(value);
    setParseError(null);
    setParsed(null);

    if (!value.trim()) {
      return;
    }

    try {
      const result = await parseKey(value);
      setParsed(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid key");
    }
  }, []);

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    await handleKeyChange(text);
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleConfirmKey = () => {
    if (!parsed) {
      return;
    }

    const record: DevKeytraceUserPublicKey.Main = {
      $type: ids.DevKeytraceUserPublicKey,
      keyType: parsed.keyType,
      fingerprint: parsed.fingerprint,
      publicKeyArmored: parsed.publicKeyArmored,
      label: label.trim() || undefined,
      comment: parsed.comment,
      expiresAt: parsed.expiresAt,
      createdAt: new Date().toISOString(),
    };

    const pending: PendingKey = {
      tempId: crypto.randomUUID(),
      record,
      parsed,
    };

    setPendingKey(pending);
    setStep("done");
  };

  const handleAdd = () => {
    if (pendingKey) {
      onAdd(pendingKey);
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  const title =
    step === "enter-key" ? KEY_WIZARD.pasteOrUpload : KEY_WIZARD.verified;

  return (
    <WizardShell title={title} onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        {/* ── Step 1: Enter key ── */}
        {step === "enter-key" && (
          <>
            <p className="text-xs text-muted">
              {KEY_WIZARD.instruction}
            </p>

            {/* Textarea */}
            <textarea
              value={rawKey}
              onChange={(e) => void handleKeyChange(e.target.value)}
              placeholder={KEY_WIZARD.placeholder}
              rows={6}
              autoFocus
              className="w-full resize-y px-3 py-2 bg-input border border-surface-border text-xs font-mono outline-none focus:border-accent placeholder:text-muted/50"
              spellCheck={false}
            />

            {/* File upload */}
            <label className="flex w-fit cursor-pointer items-center gap-1.5 border border-surface-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-white">
              <FileUp className="h-3.5 w-3.5" />
              {KEY_WIZARD.uploadFile}
              <input
                type="file"
                accept=".pub,.asc,.key,.txt"
                onChange={(e) => void handleFileLoad(e)}
                className="hidden"
              />
            </label>

            {/* Parsed key preview */}
            {parsed && (
              <div className="flex flex-col gap-1.5 border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <KeyRound className="w-3.5 h-3.5" />
                  {KEY_TYPE_LABELS[parsed.keyType] ?? parsed.keyType}
                  {parsed.algorithm && (
                    <span className="text-muted font-normal">
                      ({parsed.algorithm})
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-muted break-all">
                  {parsed.fingerprint}
                </div>
                {parsed.comment && (
                  <div className="text-xs text-muted">{parsed.comment}</div>
                )}
                {parsed.expiresAt && (
                  <div className="text-xs text-muted">
                    {KEYS.expires} {new Date(parsed.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Parse error */}
            {parseError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-3">
                ✗ {parseError}
              </div>
            )}

            {/* Optional label */}
            <input
              type="text"
              aria-label={KEY_WIZARD.labelAriaLabel}
              placeholder={KEY_WIZARD.labelPlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-surface-border text-sm outline-none focus:border-accent"
            />

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2 text-xs border border-surface-border hover:border-muted transition-colors bg-transparent"
              >
                {NAV.cancel}
              </button>
              <button
                onClick={handleConfirmKey}
                disabled={!parsed}
                className="flex-1 py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {KEY_WIZARD.addKey} <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Done ── */}
        {step === "done" && pendingKey && (
          <>
            <div className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 p-3 font-semibold">
              ✓ {KEY_WIZARD.keyValid}
            </div>
            <div className="text-xs text-muted space-y-1">
              <div>
                <span className="text-white/60">{KEY_WIZARD.type}</span>{" "}
                {KEY_TYPE_LABELS[pendingKey.parsed.keyType] ??
                  pendingKey.parsed.keyType}
              </div>
              <div className="break-all font-mono">
                <span className="text-white/60 font-sans">{KEYS.fingerprint}</span>{" "}
                {pendingKey.parsed.fingerprint}
              </div>
              {pendingKey.record.label && (
                <div>
                  <span className="text-white/60">{KEY_WIZARD.label}</span>{" "}
                  {pendingKey.record.label}
                </div>
              )}
            </div>
            <p className="text-xs text-muted">
              {KEY_WIZARD.saveNote.replace("Save changes", "")}
              <strong className="text-white/70">{NAV.save.replace(" changes", "")}</strong>.
            </p>
            <button
              onClick={handleAdd}
              className="w-full py-2 text-xs bg-accent text-white hover:bg-accent-hover transition-colors font-semibold"
            >
              {KEY_WIZARD.addToList}
            </button>
          </>
        )}
      </div>
    </WizardShell>
  );
}
