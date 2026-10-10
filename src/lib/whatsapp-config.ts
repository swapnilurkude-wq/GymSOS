import { SUPABASE_URL, getSupabase, isSupabaseConfigured } from "@/lib/supabase"

/**
 * Super Admin WhatsApp provider configuration.
 *
 * Remote mode: every call goes to the whatsapp-config
 * / whatsapp-test Edge Functions with the signed-in
 * user's access token. The functions verify the
 * Super Admin role server-side and never return the
 * access token or webhook secret (they are stored
 * encrypted and decrypted only inside Edge Functions).
 *
 * Demo mode (development only): reads report the
 * integration as not configured; mutations are
 * refused — there is no provider to configure.
 */

export interface WhatsAppConfigStatus {
  configured: boolean
  active: boolean
  provider: string | null
  phoneNumberId: string
  businessAccountId: string
  testRecipientPhone: string
  lastError: string | null
  lastTestedAt: string | null
  tested: boolean
}

export interface WhatsAppConfigSaveInput {
  provider: string
  phoneNumberId: string
  businessAccountId?: string
  accessToken: string
  webhookSecret?: string
  testRecipientPhone: string
}

export interface WhatsAppTestResult {
  providerMessageId: string
  sentTo: string
  warning?: string
}

const NOT_CONFIGURED: WhatsAppConfigStatus = {
  configured: false,
  active: false,
  provider: null,
  phoneNumberId: "",
  businessAccountId: "",
  testRecipientPhone: "",
  lastError: null,
  lastTestedAt: null,
  tested: false,
}

async function callFunction(
  name: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Record<string, unknown>> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error("You must be signed in.")
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body:
      options.body === undefined || options.method === "GET"
        ? undefined
        : JSON.stringify(options.body),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok || typeof payload.error === "string") {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The request failed."
    )
  }
  return payload
}

export async function getWhatsAppConfigStatus(): Promise<WhatsAppConfigStatus> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED

  const payload = await callFunction("whatsapp-config", { method: "GET" })
  return {
    configured: Boolean(payload.configured),
    active: Boolean(payload.active),
    provider: (payload.provider as string | null) ?? null,
    phoneNumberId: String(payload.phoneNumberId ?? ""),
    businessAccountId: String(payload.businessAccountId ?? ""),
    testRecipientPhone: String(payload.testRecipientPhone ?? ""),
    lastError: (payload.lastError as string | null) ?? null,
    lastTestedAt: (payload.lastTestedAt as string | null) ?? null,
    tested: Boolean(payload.tested),
  }
}

export async function saveWhatsAppConfig(
  input: WhatsAppConfigSaveInput
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("WhatsApp configuration is not available in demo mode.")
  }
  await callFunction("whatsapp-config", {
    body: {
      action: "save",
      provider: input.provider,
      phone_number_id: input.phoneNumberId,
      business_account_id: input.businessAccountId ?? "",
      access_token: input.accessToken,
      webhook_secret: input.webhookSecret ?? "",
      test_recipient_phone: input.testRecipientPhone,
    },
  })
}

export async function setWhatsAppActive(active: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("WhatsApp configuration is not available in demo mode.")
  }
  await callFunction("whatsapp-config", {
    body: { action: active ? "activate" : "deactivate" },
  })
}

export async function resetWhatsAppConfig(): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("WhatsApp configuration is not available in demo mode.")
  }
  await callFunction("whatsapp-config", { body: { action: "reset" } })
}

export async function sendWhatsAppTest(
  templateName = "gym_sos_test"
): Promise<WhatsAppTestResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Test messages are not available in demo mode.")
  }
  const payload = await callFunction("whatsapp-test", {
    body: { template_name: templateName },
  })
  return {
    providerMessageId: String(payload.providerMessageId ?? ""),
    sentTo: String(payload.sentTo ?? ""),
    warning: (payload.warning as string | undefined) ?? undefined,
  }
}
