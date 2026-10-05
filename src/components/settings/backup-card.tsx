import { useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  applyBackup,
  backupFileName,
  buildBackup,
  parseBackup,
  type BackupFile,
} from "@/lib/backup"
import { isSupabaseConfigured } from "@/lib/supabase"

export function BackupCard() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // With Supabase, platform data lives in Postgres —
  // exports are handled server-side (nightly pg_dump via
  // GitHub Actions, plus point-in-time recovery), so the
  // device-local JSON backup is a demo-mode feature.
  if (isSupabaseConfigured()) {
    return (
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Backup &amp; restore</CardTitle>
          <CardDescription>Handled automatically for this deployment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0 pt-6">
          <p className="text-sm text-muted-foreground">
            Platform data lives in the Supabase database, so backups
            are taken server-side:
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Nightly <code>pg_dump</code> exports with 30-day
              retention (GitHub Actions)
            </li>
            <li>
              Point-in-time recovery (7 days) on Supabase Pro
              plans, from the dashboard
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            To restore, download the latest export and run{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
              pg_restore --clean --if-exists --db-url
              &quot;$SUPABASE_DB_URL&quot; backup.dump
            </code>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  function handleDownload() {
    const backup = buildBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = backupFileName()
    link.click()
    URL.revokeObjectURL(url)
    setMessage({
      type: "success",
      text: "Backup downloaded to this device. Store it somewhere safe — it's the only copy of your platform data.",
    })
  }

  function handleFileSelected(file: File | null | undefined) {
    setMessage(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setPending(parseBackup(String(reader.result)))
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Could not read the backup file.",
        })
      }
    }
    reader.onerror = () =>
      setMessage({ type: "error", text: "Could not read the backup file." })
    reader.readAsText(file)
  }

  function handleConfirmRestore() {
    if (!pending) return
    applyBackup(pending)
    window.location.reload()
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Backup &amp; restore</CardTitle>
        <CardDescription>Export and recover all platform data</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            A backup includes every gym, member, payment, receipt, user account, receipt
            template and platform setting. It is saved as a JSON file on this device — keep
            copies in a safe place, since there is no server-side storage.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleDownload}>
              <Download className="size-3.5" />
              Download backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Restore backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>

          {message && (
            <p
              className={`flex items-start gap-1.5 text-sm ${
                message.type === "success" ? "text-success" : "text-destructive"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {message.text}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Your sign-in session and theme preference stay on this device and are not
            part of the backup.
          </p>
        </div>
      </CardContent>

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore backup?</DialogTitle>
            <DialogDescription>
              This overwrites all current platform data with the backup from{" "}
              {pending ? new Date(pending.exportedAt).toLocaleString() : ""} (
              {pending ? Object.keys(pending.data).length : 0} data sections). This cannot
              be undone, and the app will reload afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Download a fresh backup of the current data before restoring, in case you
            need to roll back.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRestore}>
              Restore backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
