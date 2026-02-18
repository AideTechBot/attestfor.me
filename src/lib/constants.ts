/** Name of the httpOnly session cookie */
export const SESSION_COOKIE_NAME = "session";

/**
 * Lexicon namespace prefix.
 * Change this to switch between lexicon versions across the whole codebase.
 * e.g. "me.attest.alpha" (current) or "me.attest" (stable, future)
 */
export const LEXICON_NS = "me.attest.alpha" as const;
