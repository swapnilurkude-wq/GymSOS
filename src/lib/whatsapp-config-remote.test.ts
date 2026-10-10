import { describe, expect, it, vi } from "vitest"

// The client lib imports the Supabase seam at load
// time — install the remote-mode mock before importing.
vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_ANON_KEY: "mock-anon-key",
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "user-jwt" } },
      }),
    },
  }),
}))

import {
  getWhatsAppConfigStatus,
  saveWhatsAppConfig,
  sendWhatsAppTest,
  setWhatsAppActive,
  resetWhatsAppConfig,
} from "@/lib/whatsapp-config"

describe("whatsapp config client — Supabase mode", () => {
  it("reads the provider status with the user's session token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        configured: true,
        active: false,
        provider: "meta-cloud-api",
        phoneNumberId: "12345",
        businessAccountId: "",
        testRecipientPhone: "919820000000",
        lastError: null,
        lastTestedAt: null,
        tested: false,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const status = await getWhatsAppConfigStatus()

    expect(status).toEqual({
      configured: true,
      active: false,
      provider: "meta-cloud-api",
      phoneNumberId: "12345",
      businessAccountId: "",
      testRecipientPhone: "919820000000",
      lastError: null,
      lastTestedAt: null,
      tested: false,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://mock.supabase.co/functions/v1/whatsapp-config")
    expect(init.method).toBe("GET")
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer user-jwt"
    )
    // GET carries no body.
    expect(init.body).toBeUndefined()

    vi.unstubAllGlobals()
  })

  it("saves credentials as a super-admin action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, action: "save" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await saveWhatsAppConfig({
      provider: "meta-cloud-api",
      phoneNumberId: "12345",
      accessToken: "EAAGl0_secret",
      testRecipientPhone: "919820000000",
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://mock.supabase.co/functions/v1/whatsapp-config")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      action: "save",
      provider: "meta-cloud-api",
      phone_number_id: "12345",
      business_account_id: "",
      access_token: "EAAGl0_secret",
      webhook_secret: "",
      test_recipient_phone: "919820000000",
    })

    vi.unstubAllGlobals()
  })

  it("activates and deactivates the integration", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await setWhatsAppActive(true)
    await setWhatsAppActive(false)
    await resetWhatsAppConfig()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse((call[1] as RequestInit).body as string)
    )
    expect(bodies).toEqual([
      { action: "activate" },
      { action: "deactivate" },
      { action: "reset" },
    ])

    vi.unstubAllGlobals()
  })

  it("sends a test message and surfaces a warning", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        providerMessageId: "msg-abc",
        sentTo: "919820000000",
        warning: "Audit log write failed",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendWhatsAppTest("gym_sos_test")

    expect(result).toEqual({
      providerMessageId: "msg-abc",
      sentTo: "919820000000",
      warning: "Audit log write failed",
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://mock.supabase.co/functions/v1/whatsapp-test")
    expect(JSON.parse(init.body as string)).toEqual({
      template_name: "gym_sos_test",
    })

    vi.unstubAllGlobals()
  })

  it("throws the edge function's error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Send a test message before activating the integration.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(setWhatsAppActive(true)).rejects.toThrow(
      "Send a test message before activating the integration."
    )

    vi.unstubAllGlobals()
  })
})
