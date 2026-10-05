import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GymFilters } from "@/components/gyms/gym-toolbar"

interface SubscriptionToolbarProps {
  filters: GymFilters
  onFiltersChange: (filters: GymFilters) => void
}

export function SubscriptionToolbar({ filters, onFiltersChange }: SubscriptionToolbarProps) {
  function set<K extends keyof GymFilters>(key: K, value: GymFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by gym, owner..."
          className="pl-9"
        />
      </div>

      <Select value={filters.status} onValueChange={(v) => set("status", v)}>
        <SelectTrigger className="h-9 w-[168px] text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="renewal-due">Renewal due</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.plan} onValueChange={(v) => set("plan", v)}>
        <SelectTrigger className="h-9 w-[152px] text-sm">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All plans</SelectItem>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="growth">Growth</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
