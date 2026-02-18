/**
 * Generate a random nonce for verification challenges
 */
export function generateNonce(): string {
  // Generate 16 random bytes (128 bits) and encode as base62
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Base62 alphabet (alphanumeric, case-sensitive)
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  let result = "";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }

  return result;
}

/**
 * Format a challenge text for a specific service
 */
export function formatChallengeText(
  did: string,
  serviceHandle: string,
  service: string,
  nonce: string,
): string {
  // Use "attestforme" instead of "attest.me" to avoid Twitter URL linkification
  return `I am ${did} on AT Protocol.\nVerifying my ${service} account ${serviceHandle} for attestforme.\nNonce: ${nonce}`;
}
