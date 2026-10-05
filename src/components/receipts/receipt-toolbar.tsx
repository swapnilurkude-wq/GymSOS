import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ReceiptFilters {
  search: string
  status: string
  paymentMode: string
  range: string
}

interface ReceiptToolbarProps {
  filters: ReceiptFilters
  onFiltersChange: (filters: ReceiptFilters) => void
}

export function ReceiptToolbar({ filters, onFiltersChange }: ReceiptToolbarProps) {
  function set<K extends keyof ReceiptFilters>(key: K, value: ReceiptFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by receipt no. or member name..."
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

      <Select value={filters.status} onValueChange={(v) => set("status", v)}>
        <SelectTrigger className="h-9 w-[152px] text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partially paid</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.paymentMode} onValueChange={(v) => set("paymentMode", v)}>
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
