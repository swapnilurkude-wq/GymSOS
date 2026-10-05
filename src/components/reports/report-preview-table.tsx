import { FileBarChart } from "lucide-react"

export interface ReportColumn {
  key: string
  label: string
  align?: "left" | "right"
}

interface ReportPreviewTableProps {
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
}

export function ReportPreviewTable({ columns, rows }: ReportPreviewTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileBarChart className="size-6" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">No records for this report</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try a different report type — there's nothing to show here yet.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-premium">
      <table id="report-preview-table" className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-medium ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-5 py-3 tabular-nums text-foreground ${col.align === "right" ? "text-right" : ""}`}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
