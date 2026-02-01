/**
 * Token encryption utilities for secure storage of sensitive data.
 * Uses AES-256-GCM encryption with a key derived from an environment variable.
 *
 * IMPORTANT: Set ENCRYPTION_KEY environment variable to a secure 32-byte hex string.
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Regex pattern for valid 64-character hex string (32 bytes).
 */
const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * Get the encryption key from environment variable.
 * The key should be a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Uint8Array {
  const keyHex = process.env.ENCRYPTION_KEY;

  // Validate key exists and matches hex pattern
  if (!keyHex || !HEX_KEY_PATTERN.test(keyHex)) {
    throw new Error(
      "ENCRYPTION_KEY environment variable must be a valid 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
  }
  return keyBytes;
}

/**
 * Import the encryption key for use with Web Crypto API.
 */
async function importKey(): Promise<CryptoKey> {
  const keyBytes = getEncryptionKey();
  return await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string.
 * @returns Object containing the encrypted data (base64) and IV (base64)
 */
export async function encryptToken(
  plaintext: string
): Promise<{ encrypted: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  // Convert to base64 for storage
  const encrypted = btoa(
    String.fromCharCode(...new Uint8Array(encryptedBuffer))
  );
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return { encrypted, iv: ivBase64 };
}

/**
 * Decrypt an encrypted string.
 * @param encrypted Base64-encoded encrypted data
 * @param iv Base64-encoded initialization vector
 * @returns The decrypted plaintext string
 */
export async function decryptToken(
  encrypted: string,
  iv: string
): Promise<string> {
  const key = await importKey();

  // Convert from base64
  const encryptedBytes = Uint8Array.from(atob(encrypted), (c) =>
    c.charCodeAt(0)
  );
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    encryptedBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
