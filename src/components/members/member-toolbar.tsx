import { useRef, type ReactElement } from "react"
import { Search, UserPlus, Download, Upload, FileDown, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface MemberFilters {
  search: string
  status: string
  plan: string
  type: string
}

interface MemberToolbarProps {
  filters: MemberFilters
  onFiltersChange: (filters: MemberFilters) => void
  onAddMember: () => void
  onExport: () => void
  onImportFile: (file: File) => void
  onDownloadTemplate: () => void
  addMemberLockedReason?: string
  importLockedReason?: string
  exportLockedReason?: string
}

export function MemberToolbar({
  filters,
  onFiltersChange,
  onAddMember,
  onExport,
  onImportFile,
  onDownloadTemplate,
  addMemberLockedReason,
  importLockedReason,
  exportLockedReason,
}: MemberToolbarProps) {
  const importInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof MemberFilters>(key: K, value: MemberFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  function lockedButton(key: string, reason: string | undefined, button: ReactElement) {
    if (!reason) return button
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search by name, contact, receipt no..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImportFile(file)
              e.target.value = ""
            }}
          />
          {lockedButton(
            "template",
            importLockedReason,
            <Button variant="outline" size="sm" disabled={!!importLockedReason} onClick={onDownloadTemplate}>
              <FileDown className="size-3.5" />
              Template
            </Button>
          )}
          {lockedButton(
            "import",
            importLockedReason,
            <Button
              variant="outline"
              size="sm"
              disabled={!!importLockedReason}
              onClick={() => importInputRef.current?.click()}
            >
              {importLockedReason ? <Lock className="size-3.5" /> : <Upload className="size-3.5" />}
              Import Excel
            </Button>
          )}
          {lockedButton(
            "export",
            exportLockedReason,
            <Button variant="outline" size="sm" disabled={!!exportLockedReason} onClick={onExport}>
              {exportLockedReason ? <Lock className="size-3.5" /> : <Download className="size-3.5" />}
              Export Excel
            </Button>
          )}
          {lockedButton(
            "add-member",
            addMemberLockedReason,
            <Button size="sm" disabled={!!addMemberLockedReason} onClick={onAddMember}>
              {addMemberLockedReason ? <Lock className="size-3.5" /> : <UserPlus className="size-3.5" />}
              Add Member
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="h-9 w-[168px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring soon</SelectItem>
            <SelectItem value="pending">Payment pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.plan} onValueChange={(v) => set("plan", v)}>
          <SelectTrigger className="h-9 w-[152px] text-sm">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="Monthly">Monthly</SelectItem>
            <SelectItem value="Quarterly">Quarterly</SelectItem>
            <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
            <SelectItem value="Annual">Annual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => set("type", v)}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">New & Renewal</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="renewal">Renewal</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
