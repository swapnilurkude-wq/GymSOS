import { formatCurrency, formatCurrencyPdfSafe } from "@/lib/format"
import type { Gender, Member } from "@/types"
import { GENDER_LABEL } from "@/types"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function paymentModeLabel(member: Member, money: (value: number) => string = formatCurrency): string {
  if (member.paymentMode === "cash") return "Cash"
  if (member.paymentMode === "online") return "Online"
  return `Mixed (Cash ${money(member.cashAmount)} + Online ${money(member.onlineAmount)})`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function receiptRows(
  member: Member,
  gymName: string,
  money: (value: number) => string = formatCurrency
): [string, string][] {
  return [
    ["Receipt No.", member.receiptNumber],
    ["Payment Date", formatDate(member.paymentDate)],
    ["Member Name", member.name],
    ["Contact Number", member.contactNumber],
    ["Gender", GENDER_LABEL[member.gender as Gender] ?? member.gender],
    ["Address", member.address || "—"],
    ["Membership Type", member.memberType === "new" ? "New Member" : "Renewal"],
    ["Plan", `${member.plan} (${member.durationMonths} month${member.durationMonths > 1 ? "s" : ""})`],
    ["Start Date", formatDate(member.startDate)],
    ["End Date", formatDate(member.endDate)],
    ["Amount", money(member.amount)],
    ["Discount", money(member.discount)],
    ["Paid Amount", money(member.paidAmount)],
    ["Balance Amount", money(member.balanceAmount)],
    ["Payment Mode", paymentModeLabel(member, money)],
    ["Received By", member.paymentReceiver],
    ["Gym", gymName],
  ]
}

export function printReceipt(member: Member, gymName: string): void {
  const win = window.open("", "_blank", "width=480,height=720")
  if (!win) return

  const rows = receiptRows(member, gymName)
    .map(
      ([label, value]) =>
        `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`
    )
    .join("")

  const notes = member.notes
    ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(member.notes)}</div>`
    : ""

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(member.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 32px; color: #17171a; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #6f4dff; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 20px; margin: 0; }
  .header p { margin: 2px 0 0; color: #6b6b74; font-size: 12px; }
  .badge { background: #6f4dff; color: white; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 7px 0; border-bottom: 1px solid #ececef; }
  .label { color: #6b6b74; width: 45%; }
  .value { font-weight: 600; text-align: right; }
  .notes { margin-top: 16px; font-size: 12px; color: #6b6b74; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #9a9aa2; }
  .sign { border-top: 1px solid #cfcfd6; padding-top: 6px; width: 160px; text-align: center; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(gymName)}</h1>
      <p>Payment Receipt</p>
    </div>
    <span class="badge">${escapeHtml(member.receiptNumber)}</span>
  </div>
  <table>${rows}</table>
  ${notes}
  <div class="footer">
    <div class="sign">Payment Receiver</div>
    <div class="sign">Authorized Signatory</div>
  </div>
</body>
</html>`)

  win.document.close()
  win.focus()
  win.onload = () => win.print()
  setTimeout(() => win.print(), 300)
}

export async function downloadReceiptPdf(member: Member, gymName: string): Promise<void> {
  // jspdf is loaded on demand — PDFs are user-triggered, so it stays
  // out of the initial bundle.
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginX = 48
  let y = 56

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(23, 23, 26)
  doc.text(gymName, marginX, y)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(107, 107, 116)
  doc.text("Payment Receipt", marginX, y + 18)

  doc.setDrawColor(111, 77, 255)
  doc.setLineWidth(2)
  doc.line(marginX, y + 30, 547, y + 30)

  y += 56

  const rows = receiptRows(member, gymName, formatCurrencyPdfSafe)
  doc.setFontSize(11)

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 107, 116)
    doc.text(label, marginX, y)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(23, 23, 26)
    doc.text(value, 547, y, { align: "right" })

    doc.setDrawColor(236, 236, 239)
    doc.setLineWidth(0.5)
    doc.line(marginX, y + 8, 547, y + 8)

    y += 24
  }

  if (member.notes) {
    y += 12
    doc.setFont("helvetica", "bold")
    doc.setTextColor(23, 23, 26)
    doc.text("Notes:", marginX, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 107, 116)
    const noteLines = doc.splitTextToSize(member.notes, 500)
    doc.text(noteLines, marginX, y + 16)
    y += 16 + noteLines.length * 14
  }

  y += 60
  doc.setDrawColor(200, 200, 205)
  doc.line(marginX, y, marginX + 140, y)
  doc.line(407, y, 547, y)
  doc.setFontSize(9)
  doc.setTextColor(154, 154, 162)
  doc.text("Payment Receiver", marginX, y + 14)
  doc.text("Authorized Signatory", 407, y + 14)

  doc.save(`${member.receiptNumber}.pdf`)
}
