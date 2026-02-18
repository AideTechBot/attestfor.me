import { Loader2, Check, X } from "lucide-react";

export type VerifyStatus = "idle" | "loading" | "verified" | "failed";

interface StatusBadgeProps {
  status: VerifyStatus;
  onVerify?: () => void;
}

export function StatusBadge({ status, onVerify }: StatusBadgeProps) {
  if (status === "loading") {
    return (
      <div className="shrink-0 w-7 h-7 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
        <X className="w-3 h-3 text-white" />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onVerify?.();
      }}
      className="shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs font-bold cursor-pointer hover:bg-white/15 transition-colors"
      aria-label="Verify this account"
    >
      ?
    </button>
  );
}
