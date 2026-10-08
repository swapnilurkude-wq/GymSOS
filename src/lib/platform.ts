/**
 * Platform contact details for the trial-upgrade flow.
 *
 * These are the single source for the "WhatsApp Us" and
 * "Contact Admin" actions on the trial-expired screen —
 * update both values here before launch.
 */
export const PLATFORM_ADMIN_EMAIL = "swapnilpurkude2017@gmail.com"
export const PLATFORM_WHATSAPP = "919922850042"

export function whatsappUrl(message: string): string {
  return `https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent(message)}`
}

export function adminMailto(subject: string): string {
  return `mailto:${PLATFORM_ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}`
}
