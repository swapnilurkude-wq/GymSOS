/**
 * Credential encryption for the WhatsApp provider
 * config.
 *
 * AES-256-GCM with a PBKDF2-derived key. The
 * encryption secret (WHATSAPP_ENCRYPTION_KEY) lives
 * ONLY in Edge Function secrets — never in the
 * database, never in the frontend. The database
 * stores "base64(iv):base64(ciphertext)".
 *
 * Uses WebCrypto, available in Deno and Node 18+.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

const PBKDF2_SALT = "gym-sos-whatsapp-v1"
const PBKDF2_ITERATIONS = 100_000

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptSecret(
  plaintext: string,
  encryptionKey: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await deriveKey(encryptionKey),
    enc.encode(plaintext)
  )
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`
}

/** Throws when the payload was tampered with or the key is wrong. */
export async function decryptSecret(
  payload: string,
  encryptionKey: string
): Promise<string> {
  const separator = payload.indexOf(":")
  if (separator < 0) {
    throw new Error("Malformed encrypted payload.")
  }
  const iv = fromBase64(payload.slice(0, separator))
  const cipher = fromBase64(payload.slice(separator + 1))
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await deriveKey(encryptionKey),
    cipher
  )
  return dec.decode(plain)
}
