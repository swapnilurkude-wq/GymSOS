import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface PaymentFilters {
  search: string
  mode: string
  range: string
}

interface PaymentToolbarProps {
  filters: PaymentFilters
  onFiltersChange: (filters: PaymentFilters) => void
}

export function PaymentToolbar({ filters, onFiltersChange }: PaymentToolbarProps) {
  function set<K extends keyof PaymentFilters>(key: K, value: PaymentFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by member, receipt no..."
          className="pl-9"
        />
      </div>

      <Select value={filters.range} onValueChange={(v) => set("range", v)}>
        <SelectTrigger className="h-9 w-[152px] text-sm">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">This month</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.mode} onValueChange={(v) => set("mode", v)}>
        <SelectTrigger className="h-9 w-[152px] text-sm">
          <SelectValue placeholder="Payment mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All modes</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="online">Online</SelectItem>
          <SelectItem value="mixed">Mixed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
