import { Search, Building2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface GymFilters {
  search: string
  status: string
  plan: string
}

interface GymToolbarProps {
  filters: GymFilters
  onFiltersChange: (filters: GymFilters) => void
  onAddGym: () => void
}

export function GymToolbar({ filters, onFiltersChange, onAddGym }: GymToolbarProps) {
  function set<K extends keyof GymFilters>(key: K, value: GymFilters[K]) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search by gym, location, owner..."
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={onAddGym}>
          <Building2 className="size-3.5" />
          Add Gym
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  )
}
