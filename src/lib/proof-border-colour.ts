/**
 * Returns the Tailwind border-left colour class for a proof card strip.
 *
 * Rules (in priority order):
 *  1. retracted  → always red, regardless of verification state
 *  2. verifying  → yellow
 *  3. verified   → green
 *  4. failed     → red
 *  5. unattempted (idle/null) → light grey
 */

export type ProofCardVerifyState = "idle" | "loading" | "verified" | "failed";
export type ProofRecordStatus = "active" | "retracted";

export function getProofBorderColour(
  recordStatus: ProofRecordStatus,
  verifyState: ProofCardVerifyState | null,
): string {
  if (recordStatus === "retracted") {
    return "border-l-red-500";
  }

  switch (verifyState) {
    case "loading":
      return "border-l-yellow-500";
    case "verified":
      return "border-l-green-500";
    case "failed":
      return "border-l-red-500";
    default:
      return "border-l-white/20";
  }
}
