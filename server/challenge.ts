import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random nonce
 * @param bits Minimum bits of entropy (default: 128)
 * @returns Base62-encoded nonce string
 */
export function generateNonce(bits: number = 128): string {
  const bytes = Math.ceil(bits / 8);
  const buffer = randomBytes(bytes);

  // Convert to base62 (alphanumeric)
  const base62Chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";

  // Convert buffer to base62
  let num = BigInt("0x" + buffer.toString("hex"));
  while (num > 0n) {
    result = base62Chars[Number(num % 62n)] + result;
    num = num / 62n;
  }

  // Ensure minimum length
  const minLength = Math.ceil((bits * Math.log(2)) / Math.log(62));
  while (result.length < minLength) {
    result = base62Chars[0] + result;
  }

  return result;
}

/**
 * Format challenge text for a proof
 * @param did User's DID
 * @param service Service name (e.g., 'twitter', 'github')
 * @param handle User's handle on the service
 * @param nonce Cryptographic nonce
 * @returns Formatted challenge text
 */
export function formatChallengeText(
  did: string,
  service: string,
  handle: string,
  nonce: string,
): string {
  return `I am ${did} on AT Protocol.
Verifying my ${service} account ${handle} for attest.me.
Nonce: ${nonce}`;
}

/**
 * Validate a nonce meets minimum entropy requirements
 * @param nonce The nonce to validate
 * @param minBits Minimum bits of entropy (default: 128)
 * @returns true if valid, false otherwise
 */
export function validateNonce(nonce: string, minBits: number = 128): boolean {
  if (!nonce || typeof nonce !== "string") {
    return false;
  }

  // Base62 entropy: log2(62) ≈ 5.954 bits per character
  const minLength = Math.ceil(minBits / 5.954);
  if (nonce.length < minLength) {
    return false;
  }

  // Verify only base62 characters
  const base62Regex = /^[0-9A-Za-z]+$/;
  return base62Regex.test(nonce);
}

/**
 * Parse challenge text and extract components
 * @param challengeText The challenge text to parse
 * @returns Parsed components or null if invalid
 */
export function parseChallengeText(challengeText: string): {
  did: string;
  service: string;
  handle: string;
  nonce: string;
} | null {
  // Match pattern: "I am {did} on AT Protocol.\nVerifying my {service} account {handle} for attest.me.\nNonce: {nonce}"
  const pattern =
    /^I am (did:[a-z]+:[a-zA-Z0-9._:%-]+) on AT Protocol\.\nVerifying my ([a-z]+) account (.+) for attest\.me\.\nNonce: ([0-9A-Za-z]+)$/;

  const match = challengeText.match(pattern);
  if (!match) {
    return null;
  }

  return {
    did: match[1],
    service: match[2],
    handle: match[3],
    nonce: match[4],
  };
}
