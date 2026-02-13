/** Cache TTL values in seconds */

/** DID document cache — DID docs change very infrequently */
export const DID_DOC_TTL = 1800; // 30 min

/** Handle → DID resolution cache */
export const HANDLE_TTL = 1800; // 30 min

/** Profile record cache (displayName, description, avatar ref) */
export const PROFILE_TTL = 1800; // 30 min

/** Authenticated session profile cache */
export const SESSION_PROFILE_TTL = 1800; // 30 min

/** Followers / follows list cache */
export const FOLLOWERS_TTL = 1800; // 30 min

/** Avatar blob cache — CIDs are content-addressed (immutable) */
export const AVATAR_TTL = 604800; // 7 days
