import { AlertCircle, RefreshCw } from "lucide-react"

interface DataErrorBannerProps {
  error: string | null
  onRetry?: () => void
}

/**
 * Shown when a background data load fails (e.g. a network
 * blip in Supabase mode), so a failed query reads as an
 * error instead of an empty table.
 */
export function DataErrorBanner({ error, onRetry }: DataErrorBannerProps) {
  if (!error) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{error}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <RefreshCw className="size-3" />
          Retry
        </button>
      )}
    </div>
  )
}
