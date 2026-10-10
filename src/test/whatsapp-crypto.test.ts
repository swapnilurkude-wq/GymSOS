import { describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret } from "../../supabase/functions/_shared/whatsapp/crypto"

const KEY = "test-encryption-key-0123456789"

describe("WhatsApp credential encryption", () => {
  it("round-trips a secret", async () => {
    const ciphertext = await encryptSecret(
      "EAAGl0ZAbc123_token",
      KEY
    )
    // The payload is "base64(iv):base64(ciphertext)"
    // and never contains the plaintext.
    expect(ciphertext).not.toContain("EAAGl0ZAbc123_token")
    expect(ciphertext).toMatch(/^[^:]+:[^:]+$/)

    const plaintext = await decryptSecret(ciphertext, KEY)
    expect(plaintext).toBe("EAAGl0ZAbc123_token")
  })

  it("produces a different ciphertext each time (random IV)", async () => {
    const a = await encryptSecret("same-secret", KEY)
    const b = await encryptSecret("same-secret", KEY)
    expect(a).not.toBe(b)
    expect(await decryptSecret(a, KEY)).toBe("same-secret")
    expect(await decryptSecret(b, KEY)).toBe("same-secret")
  })

  it("refuses to decrypt with the wrong key", async () => {
    const ciphertext = await encryptSecret("secret", KEY)
    await expect(
      decryptSecret(ciphertext, "wrong-key")
    ).rejects.toThrow()
  })

  it("refuses to decrypt tampered ciphertext", async () => {
    const ciphertext = await encryptSecret("secret", KEY)
    const [iv, body] = ciphertext.split(":")
    // Flip a character in the ciphertext body.
    const flipped =
      (body[0] === "A" ? "B" : "A") + body.slice(1)
    await expect(
      decryptSecret(`${iv}:${flipped}`, KEY)
    ).rejects.toThrow()
  })

  it("rejects malformed payloads", async () => {
    await expect(decryptSecret("no-separator", KEY)).rejects.toThrow()
  })
})
