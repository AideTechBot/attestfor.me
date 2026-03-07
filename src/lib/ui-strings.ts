/**
 * Centralized user-facing strings for the app.
 * Organized by category for easy maintenance and future i18n support.
 */

// ============================================================================
// Site & Branding
// ============================================================================

export const SITE = {
  name: "attestfor.me",
  tagline: "Your accounts, proven to be yours.",
  description:
    "ATtestfor.me is a link page for your online accounts, like Linktree, but every account listed is cryptographically verified to actually belong to you. No one can fake or tamper with the connections between your identity and your accounts.",
  descriptionCta:
    "Sign in with your AT Protocol account to build your verified profile. Visitors can look you up and know for certain that every linked account is genuinely yours.",
  whatIsThis: "What is this?",
  howItWorks: "How does the verification work?",
  cryptographicallyVerified: "cryptographically verified",
} as const;

// ============================================================================
// Navigation & Actions
// ============================================================================

export const NAV = {
  backToHome: "Back to Home",
  backToProfile: "Back to profile",
  back: "Back",
  next: "Next",
  cancel: "Cancel",
  close: "Close",
  save: "Save changes",
  saving: "Saving...",
  discard: "Discard changes",
  retry: "Retry",
  signIn: "Sign in",
  signOut: "Sign out",
  continue: "Continue",
  goAnyway: "Go anyway",
  dismiss: "Dismiss",
  clearAll: "Clear all",
  visitProfile: "Visit profile",
  editProfile: "Edit profile",
  simpleView: "Simple view",
  viewDetails: "View technical details",
  goToHomepage: "Go to homepage",
  faq: "faq",
  github: "github",
  tangled: "tangled",
  madeBy: "made by manoo",
} as const;

// ============================================================================
// Auth
// ============================================================================

export const AUTH = {
  signingIn: "Signing in...",
  handlePlaceholder: "your.handle.example",
  handleLabel: "Your AT Protocol handle",
  mustBeSignedIn: "You must be signed in to edit claims.",
} as const;

export const AUTH_ERRORS = {
  handleRequired: "Handle is required. Please enter your handle and try again.",
  invalidHandle: "Invalid handle. Please check your handle and try again.",
  initFailed: "Failed to initiate login. Please try again.",
  accessDenied: "User denied access to their account.",
  networkError: "Network error. Please check your connection and try again.",
  sessionExpired: "Authentication session expired. Please try again.",
  invalidResponse: "Invalid authentication response. Please try again.",
  authFailed: "Authentication failed. Please try again.",
  unexpected: "An unexpected error occurred",
} as const;

// ============================================================================
// Profile
// ============================================================================

export const PROFILE = {
  shareProfile: "Share profile",
  verifyAll: "Click to verify all accounts",
  copyDid: "Copy DID",
  copyDidToClipboard: "Copy DID to clipboard",
  copied: "Copied!",
  claims: "claims",
  keys: "keys",
  profileSections: "Profile sections",
  claimsTab: (count: number) => `Claims (${count})`,
  keysTab: (count: number) => `Keys (${count})`,
} as const;

export const PROFILE_EMPTY = {
  noAccounts: "No verified accounts yet",
  noAccountsDesc: "This user hasn't linked any external accounts.",
  noClaims: "No claims found",
  noClaimsDesc: "This user hasn't published any identity claims yet.",
  noKeys: "No keys published",
  noKeysDesc: "This user hasn't published any public keys yet.",
} as const;

// ============================================================================
// Claims
// ============================================================================

export const CLAIMS = {
  addClaim: "+ Add claim",
  verify: "Verify",
  verifying: "Verifying...",
  verified: "verified",
  retracted: "retracted",
  new: "new",
  willDelete: "will delete",
  remove: "Remove",
  delete: "Delete",
  deleteRecord: "Delete record",
  undo: "Undo",
} as const;

export const CLAIM_WIZARD = {
  selectService: "Add claim: Select service",
  selectServiceDesc:
    "Choose the service you want to link to your AT Protocol identity.",
  enterDomain: "Enter the domain you want to verify.",
  dnsInstruction: (domain: string) =>
    `Add a TXT record at _keytrace.${domain} with the following value:`,
  dnsPropagation: "DNS changes may take a few minutes to propagate.",
  postInstruction: (service: string, handle: string) =>
    `Post the following text publicly on ${service} as ${handle}, then paste the URL to that post below.`,
  pasteUrl: "Paste the URL of the post containing the proof text.",
  urlPlaceholder: "https://...",
  iPostedIt: "I've posted it",
  copy: "Copy",
  claimVerified: "Claim verified successfully",
  addToList: "Add to list",
  saveNote:
    "This proof will be saved to your repo when you click Save changes.",
  service: "Service:",
  handle: "Handle:",
  claimUri: "Claim URI:",
  enterHandle: (service: string) => `Enter your ${service} handle.`,
  title: (step: string, service?: string, isDns?: boolean) => {
    const titles: Record<string, string> = {
      "select-service": "Add claim: Select service",
      "enter-handle": `Add claim: ${service ?? ""}`,
      "show-challenge": isDns
        ? "Add claim: Add DNS record"
        : "Add claim: Post challenge",
      verify: "Add claim: Verify",
      done: "Add claim: Verified",
    };
    return titles[step] ?? "Add claim";
  },
} as const;

export const CLAIM_ERRORS = {
  dnsLookupFailed: "DNS lookup failed",
  dnsVerificationFailed: "DNS verification failed",
  handleMismatch: "Handle mismatch",
  urlNoMatch: "This URL doesn't match any known service provider",
  noVerifier: (type: string) => `No verifier available for "${type}"`,
} as const;

// ============================================================================
// Verification
// ============================================================================

export const VERIFY = {
  clickToVerify: "Click to verify",
  passedRerun: "Passed - click to re-run",
  failedRetry: "Failed - click to retry",
  verifyThisAccount: "Verify this account",
  replayVerification: "Replay verification",
  claimValid: "Claim is valid",
  claimInvalid: (error: string) => `Claim is invalid: ${error}`,
  passed: "passed",
  failed: "failed",
  unknown: "unknown",
} as const;

export const VERIFY_ERRORS = {
  noProofContent: "Verification failed: no proof content was found.",
  noExpectedFile: (paths: string) =>
    `No expected file found. Please name your file one of: ${paths}`,
  noContentAtLocation: "No proof content was found at the expected location.",
  didNotFound:
    "DID not found in claim content. Make sure the proof text matches exactly.",
  noTxtRecord: (domain: string) =>
    `No matching TXT record found at _keytrace.${domain}`,
  handleMismatch: (expected: string, actual: string) =>
    `Handle mismatch: expected "${expected}", got "${actual}"`,
} as const;

export const VERIFY_STEPS = {
  checkingUri: "Checking claim URI against providers...",
  matchedProvider: (name: string) => `Matched provider: ${name}`,
  fetchingContent: "Fetching claim content and verifying...",
  didFoundInDns: "DID found in DNS TXT records",
  verifyingHandle: "Verifying identity handle...",
  handleVerified: (subject: string) => `Handle verified: ${subject}`,
} as const;

// ============================================================================
// Keys
// ============================================================================

export const KEYS = {
  addKey: "+ Add key",
  retract: "Retract",
  willRetract: "will retract",
  retracted: "Retracted",
  expired: "Expired",
  fingerprint: "Fingerprint:",
  published: "Published:",
  expires: "Expires:",
  showPublicKey: "Show public key",
  hidePublicKey: "Hide public key",
  copyPublicKey: "Copy public key",
} as const;

export const KEY_WIZARD = {
  pasteOrUpload: "Add key: Paste or upload",
  verified: "Add key: Verified",
  instruction:
    "Paste a PGP or SSH public key. It will be validated before adding.",
  placeholder: "Paste your public key here (PGP, SSH Ed25519, or SSH ECDSA)...",
  uploadFile: "Upload .pub / .asc file",
  labelAriaLabel: "Key label (optional)",
  labelPlaceholder: "Label (optional, e.g. work laptop, signing key)",
  addKey: "Add key",
  keyValid: "Key is valid",
  type: "Type:",
  label: "Label:",
  saveNote: "This key will be saved to your repo when you click Save changes.",
  addToList: "Add to list",
} as const;

export const KEY_RETRACT = {
  title: "Retract this key?",
  warning: (label: string) =>
    `${label} will be permanently marked as retracted. This cannot be undone.`,
  confirm: "Yes, retract permanently",
} as const;

// ============================================================================
// Detailed Claim Card
// ============================================================================

export const DETAIL_LABELS = {
  status: "Status",
  verification: "Verification",
  subject: "Subject",
  claimUri: "Claim URI",
  created: "Created",
  retractedAt: "Retracted",
  recordUri: "Record URI",
  cid: "CID",
  nonce: "Nonce",
} as const;

// ============================================================================
// Simple Claim Card Warning
// ============================================================================

export const CLAIM_WARNING = {
  headsUp: "Heads up:",
  message: (service: string, subject: string) =>
    `this ${service} account could not be verified as owned by ${subject}. Are you sure you want to continue to ${service}?`,
} as const;

// ============================================================================
// Edit Lists
// ============================================================================

export const EDIT_LIST = {
  noClaimsYet: "No claims yet.",
  noKeysYet: "No keys yet.",
  addOneBelow: "Add one below.",
} as const;

// ============================================================================
// Search
// ============================================================================

export const SEARCH = {
  placeholder: "Search...",
  ariaLabel: "Search for a user",
  goTo: "Go to",
  suggestions: "Suggestions",
  fromFollowers: "From your followers",
  recent: "Recent",
  removeRecent: (handle: string) => `Remove ${handle} from recent searches`,
} as const;

// ============================================================================
// Loading & Status
// ============================================================================

export const LOADING = {
  loading: "Loading...",
  loadingClaims: "Loading claims...",
  loadingKeys: "Loading keys...",
} as const;

export const ERRORS = {
  failedToLoadClaims: "Failed to load claims.",
  failedToLoadKeys: "Failed to load keys.",
  saveFailed: "Save failed.",
  failedToDelete: (type: string) => `Failed to delete ${type}`,
  failedToPublish: (type: string) => `Failed to publish ${type}`,
  failedToRetract: (type: string) => `Failed to retract ${type}`,
} as const;

export const SUCCESS = {
  changesSaved: "Changes saved successfully.",
} as const;

// ============================================================================
// Edit Profile Page
// ============================================================================

export const EDIT_PROFILE = {
  title: "Edit profile",
  saveChanges: (count: number) => `Save changes (${count})`,
  claimsToAdd: (count: number) =>
    `+ ${count} claim${count !== 1 ? "s" : ""} to add`,
  claimsToDelete: (count: number) =>
    `− ${count} claim${count !== 1 ? "s" : ""} to delete`,
  keysToAdd: (count: number) =>
    `+ ${count} key${count !== 1 ? "s" : ""} to add`,
  keysToRetract: (count: number) =>
    `⊘ ${count} key${count !== 1 ? "s" : ""} to retract`,
  keysToDelete: (count: number) =>
    `− ${count} key${count !== 1 ? "s" : ""} to delete`,
} as const;

// ============================================================================
// FAQ
// ============================================================================

export const FAQ = {
  title: "FAQ",
  subtitle: "Everything you need to know about ATtestfor.me",
  backToHome: "Back to home",
} as const;

// ============================================================================
// Misc
// ============================================================================

export const MISC = {
  offline: "No internet connection",
  notFound: "404",
  pageNotFound: "Page not found",
  accountMenu: "Account menu",
} as const;

// ============================================================================
// Meta Titles
// ============================================================================

export const META = {
  profileTitle: (name: string, handle: string) =>
    `${name} (@${handle}) | ATtestfor.me`,
} as const;
