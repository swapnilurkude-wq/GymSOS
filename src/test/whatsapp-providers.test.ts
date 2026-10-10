import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createProvider,
  MetaCloudApiProvider,
  NotImplementedProvider,
} from "../../supabase/functions/_shared/whatsapp/providers"
import type { ProviderConfigRow } from "../../supabase/functions/_shared/whatsapp/types"

const CONFIG: ProviderConfigRow = {
  provider: "meta-cloud-api",
  phone_number_id: "12345",
  business_account_id: "",
  encrypted_access_token: null,
  encrypted_webhook_secret: null,
  test_recipient_phone: "919820000000",
  is_configured: true,
  is_active: true,
  last_error: null,
  last_tested_at: null,
  tested_by: null,
}

describe("Meta Cloud API provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts an approved template to the phone-number endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "msg-abc" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const provider = new MetaCloudApiProvider({
      phoneNumberId: "12345",
      accessToken: "token",
    })
    const result = await provider.send({
      to: "919820000000",
      templateName: "gym_sos_daily_tip",
      templateParams: { "1": "Aarav", "2": "3 days" },
    })

    expect(result).toEqual({ ok: true, providerMessageId: "msg-abc" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ]
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/12345/messages"
    )
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer token")
    expect(headers["Content-Type"]).toBe("application/json")

    const body = JSON.parse(init.body as string)
    expect(body.messaging_product).toBe("whatsapp")
    expect(body.to).toBe("919820000000")
    expect(body.type).toBe("template")
    expect(body.template.name).toBe("gym_sos_daily_tip")
    expect(body.template.language).toEqual({ code: "en" })
    // Template parameters are sent in order.
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Aarav" },
      { type: "text", text: "3 days" },
    ])
  })

  it("maps provider errors to a failed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "Invalid template", code: 131048 },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const provider = new MetaCloudApiProvider({
      phoneNumberId: "12345",
      accessToken: "token",
    })
    const result = await provider.send({
      to: "919820000000",
      templateName: "missing_template",
      templateParams: {},
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("Invalid template")
    expect(result.errorCode).toBe("131048")
  })

  it("maps network failures to a retryable error result", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("DNS failure"))
    vi.stubGlobal("fetch", fetchMock)

    const provider = new MetaCloudApiProvider({
      phoneNumberId: "12345",
      accessToken: "token",
    })
    const result = await provider.send({
      to: "919820000000",
      templateName: "gym_sos_daily_tip",
      templateParams: {},
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("DNS failure")
    expect(result.errorCode).toBe("NETWORK_ERROR")
  })

  it("rejects a success response without a message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    vi.stubGlobal("fetch", fetchMock)

    const provider = new MetaCloudApiProvider({
      phoneNumberId: "12345",
      accessToken: "token",
    })
    const result = await provider.send({
      to: "919820000000",
      templateName: "t",
      templateParams: {},
    })

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe("NO_MESSAGE_ID")
  })
})

describe("createProvider", () => {
  it("builds the Meta adapter for meta-cloud-api configs", () => {
    const provider = createProvider(CONFIG, "token")
    expect(provider).toBeInstanceOf(MetaCloudApiProvider)
    expect(provider.name).toBe("meta-cloud-api")
  })

  it("returns a clear not-implemented adapter for BSPs", () => {
    for (const name of [
      "gupshup",
      "twilio",
      "three60dialog",
    ] as const) {
      const provider = createProvider(
        { ...CONFIG, provider: name },
        "token"
      )
      expect(provider).toBeInstanceOf(NotImplementedProvider)
      expect(provider.name).toBe(name)
    }
  })
})
