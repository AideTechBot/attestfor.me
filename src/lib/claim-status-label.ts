import type { VerifyStatus } from "./verification-context";

export type StatusColour = "neutral" | "green" | "yellow" | "red";

export interface ClaimStatusLabel {
  label: string;
  colour: StatusColour;
}

/**
 * Derives the summary label and colour for a set of claim verification statuses.
 *
 * Rules:
 *   - Nothing attempted (no verified, no failed) → neutral grey
 *   - At least one failed, zero verified          → red
 *   - Some verified, rest don’t matter            → yellow
 *   - All claims verified (only green case)       → green
 *
 * When there are unattempted (idle/loading) claims, "· N unknown" is appended
 * to the label (omitted when every claim has a final result).
 */
export function getClaimStatusLabel(
  total: number,
  statuses: VerifyStatus[],
): ClaimStatusLabel {
  const verified = statuses.filter((s) => s === "verified").length;
  const failed = statuses.filter((s) => s === "failed").length;
  const unknown = statuses.filter(
    (s) => s === "idle" || s === "loading",
  ).length;
  const anyAttempted = verified > 0 || failed > 0;

  const unknownSuffix = unknown > 0 ? ` · ${unknown} unknown` : "";

  if (!anyAttempted) {
    return {
      label: `${total} linked ${total === 1 ? "account" : "accounts"}`,
      colour: "neutral",
    };
  }

  if (verified === total) {
    return {
      label: `${verified} verified ${verified === 1 ? "account" : "accounts"}`,
      colour: "green",
    };
  }

  if (failed > 0 && verified === 0) {
    return {
      label: `${failed} unverified ${failed === 1 ? "account" : "accounts"}${unknownSuffix}`,
      colour: "red",
    };
  }

  // Some verified, rest don't matter
  return {
    label: `${verified} verified · ${failed} failed${unknownSuffix}`,
    colour: "yellow",
  };
}
