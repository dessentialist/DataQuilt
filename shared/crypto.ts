import crypto from "crypto";

/**
 * Shared cryptography utilities for encrypting/decrypting small secrets like API keys.
 *
 * Algorithm: AES-256-GCM
 * - Key: 32 bytes taken from ENCRYPTION_KEY
 * - IV: 12 random bytes (recommended for GCM)
 * - AAD: the provided context (e.g., provider name like "openai")
 * - Output format: base64 strings joined as iv:tag:ciphertext
 *
 * This module validates the ENCRYPTION_KEY on import and throws if invalid.
 */

const ALGORITHM = "aes-256-gcm";
const GCM_IV_BYTE_LENGTH = 12; // 96-bit nonce recommended by NIST for GCM

function decodeEnvironmentKey(rawKey: string): Buffer {
  // Accept common encodings: base64 (preferred), hex (64 chars), or raw utf8 string of length 32
  // We DO NOT log actual secrets; only lengths for diagnostics.
  const trimmed = rawKey.trim();

  // Try base64 (Buffer.from won't throw for invalid base64; length check ensures correctness)
  const b64 = Buffer.from(trimmed, "base64");
  if (b64.length === 32) return b64;

  // Try hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const hex = Buffer.from(trimmed, "hex");
    if (hex.length === 32) return hex;
  }

  // Fallback: treat as utf8; must be exactly 32 bytes
  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error(
    `ENCRYPTION_KEY must be 32 bytes as base64 (preferred), 64-char hex, or 32-char utf8. Got ${utf8.length} bytes.`,
  );
}

function loadEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("Missing ENCRYPTION_KEY environment variable");
  }
  return decodeEnvironmentKey(key);
}

const ENCRYPTION_KEY: Buffer = loadEncryptionKey();

export function encrypt(value: string, context: string): string {
  if (typeof value !== "string") {
    throw new Error("Value to encrypt must be a string");
  }
  
  // Validate context - must be non-empty string
  if (!context || typeof context !== "string" || context.trim() === "") {
    throw new Error("Context must be a non-empty string");
  }
  
  // Validate context length and characters (basic security)
  if (context.length > 100) {
    throw new Error("Context must be 100 characters or less");
  }
  
  // Allow alphanumeric, hyphens, underscores, and dots for context
  if (!/^[a-zA-Z0-9._-]+$/.test(context)) {
    throw new Error("Context must contain only alphanumeric characters, dots, hyphens, and underscores");
  }
  
  const iv = crypto.randomBytes(GCM_IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decrypt(payload: string, context: string): string {
  if (typeof payload !== "string") {
    throw new Error("Payload to decrypt must be a string");
  }
  
  // Validate context - must be non-empty string
  if (!context || typeof context !== "string" || context.trim() === "") {
    throw new Error("Context must be a non-empty string");
  }
  
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format. Expected iv:tag:ciphertext");
  }
  const [ivB64, tagB64, cipherB64] = parts;
  
  // Validate base64 format
  try {
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(cipherB64, "base64");

    if (iv.length !== GCM_IV_BYTE_LENGTH) {
      throw new Error(`Invalid IV length: ${iv.length}. Expected ${GCM_IV_BYTE_LENGTH}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    
    try {
      const clear = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return clear.toString("utf8");
    } catch (error) {
      // Enhanced tamper detection - catch all decryption failures
      if (error instanceof Error) {
        // Check for specific authentication tag failures
        if (error.message.includes('auth') || error.message.includes('tag') || 
            error.message.includes('Invalid') || error.message.includes('decrypt')) {
          throw new Error("Decryption failed: Invalid ciphertext or authentication tag");
        }
        // Check for generic crypto errors
        if (error.name === 'Error' || error.name === 'TypeError') {
          throw new Error("Decryption failed: Invalid ciphertext or authentication tag");
        }
      }
      // Catch any other decryption failures
      throw new Error("Decryption failed: Invalid ciphertext or authentication tag");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Decryption failed")) {
      throw error;
    }
    throw new Error("Invalid encrypted data format");
  }
}

/**
 * Convenience helpers for the application to handle provider-key maps.
 * Keys are encrypted/decrypted individually with provider name as AAD.
 */
export function encryptApiKeys(keys: Record<string, string>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [provider, key] of Object.entries(keys)) {
    if (!key || key.trim() === "") continue;
    encrypted[provider] = encrypt(key, provider);
  }
  return encrypted;
}

export function decryptApiKeys(encryptedKeys: Record<string, string>): Record<string, string> {
  const decrypted: Record<string, string> = {};
  for (const [provider, payload] of Object.entries(encryptedKeys)) {
    try {
      if (!payload) continue;
      decrypted[provider] = decrypt(payload, provider);
    } catch (error) {
      // No legacy decryption fallback. Data must be rekeyed via migrate:rekey.
      throw error;
    }
  }
  return decrypted;
}
