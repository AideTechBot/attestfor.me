export type VerifyStatus = "idle" | "loading" | "verified" | "failed";

interface StatusBadgeProps {
  status: VerifyStatus;
  onVerify?: () => void;
}

export function StatusBadge({ status, onVerify }: StatusBadgeProps) {
  if (status === "loading") {
    return (
      <div className="shrink-0 w-7 h-7 flex items-center justify-center">
        <svg
          className="animate-spin text-muted"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 7L5.5 10L11.5 4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 2L10 10M10 2L2 10"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
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
