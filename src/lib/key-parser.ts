export interface ParsedKey {
  keyType: string;
  fingerprint: string;
  publicKey: string;
  comment?: string;
  expiresAt?: string;
  algorithm?: string;
}

/**
 * SHA256 fingerprint using Web Crypto API (browser-compatible).
 */
async function sha256Fingerprint(data: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer to satisfy Web Crypto's BufferSource type
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `SHA256:${base64}`;
}

// Dynamically import opengpg
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let openpgpPromise: Promise<typeof import("openpgp")> | null = null;

function getOpenpgp() {
  if (!openpgpPromise) {
    openpgpPromise = import("openpgp");
  }
  return openpgpPromise;
}

/**
 * Parse and extract fingerprint from a PGP public key.
 */
export async function parsePGPKey(armoredKey: string): Promise<ParsedKey> {
  const openpgp = await getOpenpgp();
  const key = await openpgp.readKey({ armoredKey });

  const fingerprint = key.getFingerprint().toUpperCase();
  const expirationTime = await key.getExpirationTime();
  const expiresAt =
    expirationTime instanceof Date ? expirationTime.toISOString() : undefined;

  const user = await key.getPrimaryUser();
  const comment =
    user?.user?.userID?.name || user?.user?.userID?.email || undefined;

  return {
    keyType: "pgp",
    fingerprint,
    publicKey: armoredKey.trim(),
    comment,
    expiresAt,
    algorithm: key.getAlgorithmInfo().algorithm,
  };
}

/**
 * Parse and extract fingerprint from an SSH public key.
 */
export async function parseSSHKey(sshKey: string): Promise<ParsedKey> {
  const trimmed = sshKey.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 2) {
    throw new Error("Invalid SSH key format");
  }

  const [algorithm, keyData, ...commentParts] = parts;
  const comment = commentParts.join(" ") || undefined;

  const validAlgorithms = [
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
  ];

  if (!validAlgorithms.includes(algorithm)) {
    throw new Error(`Unsupported SSH key algorithm: ${algorithm}`);
  }

  // Decode base64 key data and compute SHA256 fingerprint via Web Crypto
  const binaryString = atob(keyData);
  const keyBuffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBuffer[i] = binaryString.charCodeAt(i);
  }
  const fingerprint = await sha256Fingerprint(keyBuffer);

  // Map to keyType values matching the lexicon
  const keyType = algorithm === "ssh-ed25519" ? "ssh-ed25519" : "ssh-ecdsa";

  return {
    keyType,
    fingerprint,
    publicKey: trimmed,
    comment,
    algorithm,
  };
}

/**
 * Auto-detect and parse any supported key type.
 * Supported types are defined by the me.attest.key lexicon: pgp, ssh-ed25519, ssh-ecdsa.
 */
export async function parseKey(keyData: string): Promise<ParsedKey> {
  const trimmed = keyData.trim();

  if (trimmed.includes("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
    return parsePGPKey(trimmed);
  }
  if (trimmed.startsWith("ssh-") || trimmed.startsWith("ecdsa-")) {
    return parseSSHKey(trimmed);
  }

  throw new Error("Unknown key format. Supported: PGP, SSH (Ed25519, ECDSA)");
}
