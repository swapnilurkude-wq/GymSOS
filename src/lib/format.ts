const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const inrNumber = new Intl.NumberFormat("en-IN")

export function formatCurrency(value: number): string {
  return inr.format(value)
}

export function formatNumber(value: number): string {
  return inrNumber.format(Math.round(value))
}

export function formatCurrencyPdfSafe(value: number): string {
  // jsPDF's built-in fonts (helvetica/times/courier) can't render the ₹ glyph — it
  // shows up as a garbled superscript. Use an ASCII-safe prefix for PDF/canvas output only;
  // HTML/DOM rendering should keep using formatCurrency, which renders ₹ correctly.
  return formatCurrency(value).replace("₹", "Rs. ")
}

export function formatCompactCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, "")}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`
  return formatCurrency(value)
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

export function formatRelativeDays(iso: string): string {
  const DAY_MS = 1000 * 60 * 60 * 24
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS)

  if (diffDays === 0) return "Today"
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`
}

export function formatTimeAgo(iso: string): string {
  const MINUTE_MS = 60 * 1000
  const HOUR_MS = 60 * MINUTE_MS
  const DAY_MS = 24 * HOUR_MS

  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < MINUTE_MS) return "just now"
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`
  return `${Math.floor(diffMs / DAY_MS)}d ago`
}
