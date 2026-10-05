import { formatCurrency, formatCurrencyPdfSafe } from "@/lib/format"
import { RECEIPT_PARTICULAR_LABEL } from "@/types"
import type { Receipt, ReceiptTemplate } from "@/types"

const STATUS_LABEL: Record<Receipt["status"], string> = {
  paid: "PAID",
  partial: "PARTIALLY PAID",
  pending: "PENDING",
}

const STATUS_COLOR: Record<Receipt["status"], [number, number, number]> = {
  paid: [22, 163, 74],
  partial: [217, 119, 6],
  pending: [220, 38, 38],
}

function formatDate(iso: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function paymentModeLabel(receipt: Receipt, money: (value: number) => string = formatCurrency): string {
  if (receipt.paymentMode === "cash") return "Cash"
  if (receipt.paymentMode === "online") return "Online"
  return `Mixed (Cash ${money(receipt.cashAmount)} + Online ${money(receipt.onlineAmount)})`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl)
  const type = match?.[1]?.toUpperCase() ?? "PNG"
  return type === "JPG" ? "JPEG" : type
}

function optionalServices(receipt: Receipt): string {
  const services = []
  if (receipt.nutrition) services.push("Nutrition")
  if (receipt.personalTraining) services.push("Personal Training")
  return services.length > 0 ? services.join(", ") : "—"
}

function detailRows(receipt: Receipt, money: (value: number) => string = formatCurrency): [string, string][] {
  const rows: [string, string][] = [
    ["Member Name", receipt.memberName],
    ["Contact Number", receipt.memberContact],
    ["Date of Birth", receipt.memberDob ? formatDate(receipt.memberDob) : "—"],
    ["Particular", RECEIPT_PARTICULAR_LABEL[receipt.particular]],
    ["Plan", `${receipt.plan} (${receipt.durationMonths} month${receipt.durationMonths > 1 ? "s" : ""})`],
    ["Membership Period", `${formatDate(receipt.startDate)} to ${formatDate(receipt.endDate)}`],
    ["Total Amount", money(receipt.totalAmount)],
    ["Amount Paid", money(receipt.amountPaid)],
    ["Balance Amount", money(receipt.balanceAmount)],
  ]
  if (receipt.balancePaid > 0) rows.push(["Balance Paid (this receipt)", money(receipt.balancePaid)])
  if (receipt.balanceAmount > 0 && receipt.balanceDueDate) {
    rows.push(["Balance Due Date", formatDate(receipt.balanceDueDate)])
  }
  rows.push(["Payment Mode", paymentModeLabel(receipt, money)])
  if (receipt.paymentMode !== "cash" && receipt.transactionId) {
    rows.push(["Transaction ID", receipt.transactionId])
  }
  rows.push(["Optional Services", optionalServices(receipt)])
  return rows
}

export function printReceiptDocument(receipt: Receipt, template: ReceiptTemplate): void {
  const win = window.open("", "_blank", "width=520,height=760")
  if (!win) return

  const rows = detailRows(receipt)
    .map(
      ([label, value]) =>
        `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`
    )
    .join("")

  const notes = receipt.notes
    ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(receipt.notes)}</div>`
    : ""

  const logo = template.logoUrl
    ? `<img src="${template.logoUrl}" alt="Gym logo" class="logo" />`
    : ""

  const statusColor =
    receipt.status === "paid" ? "#16a34a" : receipt.status === "partial" ? "#d97706" : "#dc2626"

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(receipt.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 32px; color: #17171a; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #6f4dff; padding-bottom: 16px; margin-bottom: 20px; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; }
  .brand h1 { font-size: 19px; margin: 0; }
  .brand p { margin: 2px 0 0; color: #6b6b74; font-size: 11.5px; }
  .meta { text-align: right; }
  .meta .receipt-no { font-size: 13px; font-weight: 700; color: #6f4dff; }
  .meta .date { font-size: 11.5px; color: #6b6b74; margin-top: 2px; }
  .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 700; color: white; background: ${statusColor}; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 7px 0; border-bottom: 1px solid #ececef; }
  .label { color: #6b6b74; width: 50%; }
  .value { font-weight: 600; text-align: right; }
  .notes { margin-top: 16px; font-size: 12px; color: #6b6b74; }
  .terms { margin-top: 18px; font-size: 10.5px; color: #9a9aa2; border-top: 1px solid #ececef; padding-top: 10px; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #6b6b74; }
  .sign { border-top: 1px solid #cfcfd6; padding-top: 6px; width: 160px; text-align: center; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${logo}
      <div>
        <h1>${escapeHtml(template.gymName)}</h1>
        <p>${escapeHtml(template.gymAddress)}</p>
        <p>${escapeHtml(template.contactNumber)}</p>
      </div>
    </div>
    <div class="meta">
      <div class="receipt-no">${escapeHtml(receipt.receiptNumber)}</div>
      <div class="date">${formatDate(receipt.receiptDate)}</div>
      <span class="status">${STATUS_LABEL[receipt.status]}</span>
    </div>
  </div>
  <table>${rows}</table>
  ${notes}
  ${template.termsAndConditions ? `<div class="terms"><strong>Terms &amp; Conditions:</strong> ${escapeHtml(template.termsAndConditions)}</div>` : ""}
  <div class="footer">
    <div class="sign">${escapeHtml(receipt.customerSignature || "Customer Signature")}</div>
    <div class="sign">${escapeHtml(receipt.receiverSignature || template.authorizedSignatureName || "Authorized Signatory")}</div>
  </div>
</body>
</html>`)

  win.document.close()
  win.focus()
  win.onload = () => win.print()
  setTimeout(() => win.print(), 300)
}

export async function downloadReceiptDocumentPdf(
  receipt: Receipt,
  template: ReceiptTemplate
): Promise<void> {
  // jspdf is loaded on demand — PDFs are user-triggered, so it stays
  // out of the initial bundle.
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 48
  const pageWidth = 595
  const rightEdge = pageWidth - marginX
  let y = 56

  if (template.logoUrl) {
    try {
      doc.addImage(template.logoUrl, imageFormatFromDataUrl(template.logoUrl), marginX, y - 24, 40, 40)
    } catch {
      // unsupported image format — skip logo, rest of receipt still renders
    }
  }

  const textX = template.logoUrl ? marginX + 52 : marginX

  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  doc.setTextColor(23, 23, 26)
  doc.text(template.gymName, textX, y - 4)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(107, 107, 116)
  doc.text(template.gymAddress || "", textX, y + 12)
  doc.text(template.contactNumber || "", textX, y + 26)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(111, 77, 255)
  doc.text(receipt.receiptNumber, rightEdge, y - 4, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(107, 107, 116)
  doc.text(formatDate(receipt.receiptDate), rightEdge, y + 10, { align: "right" })

  const [r, g, b] = STATUS_COLOR[receipt.status]
  doc.setFillColor(r, g, b)
  const statusLabel = STATUS_LABEL[receipt.status]
  const statusWidth = doc.getTextWidth(statusLabel) + 16
  doc.roundedRect(rightEdge - statusWidth, y + 18, statusWidth, 16, 8, 8, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(statusLabel, rightEdge - statusWidth / 2, y + 29, { align: "center" })

  y += 56
  doc.setDrawColor(111, 77, 255)
  doc.setLineWidth(2)
  doc.line(marginX, y, rightEdge, y)
  y += 28

  const rows = detailRows(receipt, formatCurrencyPdfSafe)
  doc.setFontSize(11)

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 107, 116)
    doc.text(label, marginX, y)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(23, 23, 26)
    doc.text(value, rightEdge, y, { align: "right" })

    doc.setDrawColor(236, 236, 239)
    doc.setLineWidth(0.5)
    doc.line(marginX, y + 8, rightEdge, y + 8)

    y += 24
  }

  if (receipt.notes) {
    y += 12
    doc.setFont("helvetica", "bold")
    doc.setTextColor(23, 23, 26)
    doc.text("Notes:", marginX, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 107, 116)
    const noteLines = doc.splitTextToSize(receipt.notes, rightEdge - marginX)
    doc.text(noteLines, marginX, y + 16)
    y += 16 + noteLines.length * 14
  }

  if (template.termsAndConditions) {
    y += 20
    doc.setDrawColor(236, 236, 239)
    doc.line(marginX, y, rightEdge, y)
    y += 16
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(23, 23, 26)
    doc.text("Terms & Conditions", marginX, y)
    y += 12
    doc.setFont("helvetica", "normal")
    doc.setTextColor(154, 154, 162)
    const termsLines = doc.splitTextToSize(template.termsAndConditions, rightEdge - marginX)
    doc.text(termsLines, marginX, y)
    y += termsLines.length * 11
  }

  y += 56
  doc.setDrawColor(200, 200, 205)
  doc.line(marginX, y, marginX + 160, y)
  doc.line(rightEdge - 160, y, rightEdge, y)
  doc.setFontSize(9)
  doc.setTextColor(107, 107, 116)
  doc.text(receipt.customerSignature || "Customer Signature", marginX, y + 14)
  doc.text(receipt.receiverSignature || template.authorizedSignatureName || "Authorized Signatory", rightEdge - 160, y + 14)

  doc.save(`${receipt.receiptNumber}.pdf`)
}
