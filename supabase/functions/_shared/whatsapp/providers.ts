/**
 * WhatsApp provider abstraction.
 *
 * Meta Cloud API is implemented first (cheapest,
 * direct). BSP adapters (Gupshup, Twilio, 360dialog)
 * share this interface and return a clear
 * "not implemented" error until wired up — the
 * config schema already accepts them.
 *
 * Every send goes through an approved TEMPLATE —
 * WhatsApp does not allow free-form business-initiated
 * messages outside the 24-hour customer window.
 */

import type { ProviderConfigRow, WhatsAppProviderName } from "./types.ts"

export interface WhatsAppSendRequest {
  /** E.164 destination, e.g. "919820000000". */
  to: string
  /** Pre-approved template name. */
  templateName: string
  /** Ordered template body parameters. */
  templateParams: Record<string, string>
}

export interface WhatsAppSendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
  errorCode?: string
}

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName
  send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>
}

/**
 * Meta WhatsApp Cloud API.
 * POST /{apiVersion}/{phone_number_id}/messages
 * Docs: developers.facebook.com/docs/whatsapp/cloud-api
 */
export class MetaCloudApiProvider implements WhatsAppProvider {
  readonly name = "meta-cloud-api" as const

  private readonly config: {
    phoneNumberId: string
    accessToken: string
    apiVersion?: string
  }

  constructor(config: {
    phoneNumberId: string
    accessToken: string
    apiVersion?: string
  }) {
    this.config = config
  }

  async send(
    request: WhatsAppSendRequest
  ): Promise<WhatsAppSendResult> {
    const version = this.config.apiVersion ?? "v21.0"
    const url = `https://graph.facebook.com/${version}/${this.config.phoneNumberId}/messages`

    const body = {
      messaging_product: "whatsapp",
      to: request.to,
      type: "template",
      template: {
        name: request.templateName,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: Object.values(request.templateParams).map(
              (text) => ({ type: "text", text })
            ),
          },
        ],
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    } catch (networkError) {
      return {
        ok: false,
        error:
          networkError instanceof Error
            ? networkError.message
            : "Network error",
        errorCode: "NETWORK_ERROR",
      }
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as {
        error?: { message?: string; code?: number }
      }
      return {
        ok: false,
        error: payload.error?.message ?? `HTTP ${response.status}`,
        errorCode: String(payload.error?.code ?? response.status),
      }
    }

    const payload = (await response.json().catch(
      () => ({})
    )) as { messages?: Array<{ id?: string }> }
    const providerMessageId = payload.messages?.[0]?.id

    if (!providerMessageId) {
      return {
        ok: false,
        error: "Provider response missing a message id.",
        errorCode: "NO_MESSAGE_ID",
      }
    }

    return { ok: true, providerMessageId }
  }
}

/** Placeholder for BSP adapters — same interface. */
export class NotImplementedProvider implements WhatsAppProvider {
  readonly name: WhatsAppProviderName

  constructor(name: WhatsAppProviderName) {
    this.name = name
  }

  async send(): Promise<WhatsAppSendResult> {
    return {
      ok: false,
      error: `The ${this.name} adapter is not implemented yet — configure meta-cloud-api.`,
      errorCode: "ADAPTER_NOT_IMPLEMENTED",
    }
  }
}

/**
 * Builds the provider for a stored config row.
 * The access token is DECRYPTED by the caller
 * (Edge Function secret scope) and passed in —
 * this function never sees ciphertext.
 */
export function createProvider(
  config: ProviderConfigRow,
  accessToken: string
): WhatsAppProvider {
  switch (config.provider) {
    case "meta-cloud-api":
      return new MetaCloudApiProvider({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
    case "gupshup":
    case "twilio":
    case "three60dialog":
      return new NotImplementedProvider(config.provider)
  }
}
